const fs = require("fs");
const { getDatabase } = require("../db/database");
const { uploadFile, trashOrRestore } = require("./api");
const {
  beginActivity,
  endActivity,
  reportError,
  clearError,
} = require("./syncStatus");

const MAX_RETRIES = 3;
const RETRY_DELAYS = [30000, 120000, 300000]; // 30s, 2min, 5min

let isProcessing = false;

const processQueue = async () => {
  if (isProcessing) return;

  const db = getDatabase();
  const user = db.prepare("SELECT * FROM users LIMIT 1").get();
  if (!user) return;

  const pending = db
    .prepare(
      `
    SELECT * FROM sync_queue 
    WHERE user_id = ? AND status = 'pending'
    ORDER BY created_at ASC
  `,
    )
    .all(user.id);

  if (pending.length === 0) return;

  console.log(`Processing ${pending.length} queued items...`);
  isProcessing = true;

  for (const item of pending) {
    beginActivity();
    try {
      db.prepare("UPDATE sync_queue SET status = ? WHERE id = ?").run(
        "processing",
        item.id,
      );

      if (item.action === "upload") {
        if (!fs.existsSync(item.local_path)) {
          // File no longer exists locally — remove from queue
          db.prepare("DELETE FROM sync_queue WHERE id = ?").run(item.id);
          continue;
        }

        await uploadFile(
          user.frappe_url,
          user.session_cookie,
          item.local_path,
          item.local_path.split(/[\\/]/).pop(),
          user.root_folder_id,
        );
      } else if (item.action === "delete") {
        await trashOrRestore(user.frappe_url, user.session_cookie, [
          item.entity_name,
        ]);

        db.prepare(
          "DELETE FROM sync_state WHERE entity_name = ? AND user_id = ?",
        ).run(item.entity_name, user.id);
      }

      // Success — remove from queue
      db.prepare("DELETE FROM sync_queue WHERE id = ?").run(item.id);
      console.log(`Queue item processed: ${item.action} ${item.local_path}`);
      clearError();
    } catch (err) {
      console.error(`Queue item failed: ${err.message}`);
      reportError();

      const newRetries = item.retries + 1;

      if (newRetries >= MAX_RETRIES) {
        // Max retries reached — mark as failed
        db.prepare(
          "UPDATE sync_queue SET status = ?, retries = ? WHERE id = ?",
        ).run("failed", newRetries, item.id);
        console.log(
          `Queue item permanently failed after ${MAX_RETRIES} retries`,
        );
      } else {
        // Schedule retry with backoff
        const delay = RETRY_DELAYS[newRetries - 1] || 300000;
        db.prepare(
          "UPDATE sync_queue SET status = ?, retries = ? WHERE id = ?",
        ).run("pending", newRetries, item.id);
        console.log(`Retrying in ${delay / 1000}s...`);
        setTimeout(() => processQueue(), delay);
      }
    } finally {
      endActivity();
    }
  }

  isProcessing = false;
};

// Check if Frappe is reachable
const checkConnection = async (frappUrl, sessionCookie) => {
  try {
    const { getLoggedUser } = require("./api");
    await getLoggedUser(frappUrl, sessionCookie);
    return true;
  } catch {
    return false;
  }
};

// Start queue processor — checks every 30 seconds
const startQueueProcessor = () => {
  console.log("Queue processor started");

  setInterval(async () => {
    const db = getDatabase();
    const user = db.prepare("SELECT * FROM users LIMIT 1").get();
    if (!user) return;

    const isOnline = await checkConnection(
      user.frappe_url,
      user.session_cookie,
    );
    if (isOnline) {
      await processQueue();
    }
  }, 30000);
};

module.exports = { startQueueProcessor, processQueue };
