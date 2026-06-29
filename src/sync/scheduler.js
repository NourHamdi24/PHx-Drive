const { getDatabase } = require("../db/database");
const { permanentDelete } = require("./api");

const runScheduler = async () => {
  const db = getDatabase();
  const user = db.prepare("SELECT * FROM users LIMIT 1").get();
  if (!user) return;

  console.log("Running scheduler...");

  // Find all trash items older than 30 days
  const expired = db
    .prepare(
      `
    SELECT * FROM trash 
    WHERE user_id = ? 
    AND expires_at < CURRENT_TIMESTAMP
  `,
    )
    .all(user.id);

  if (expired.length === 0) {
    console.log("No expired trash items");
    return;
  }

  console.log(`Auto emptying ${expired.length} expired trash items...`);

  for (const item of expired) {
    try {
      await permanentDelete(user.frappe_url, user.session_cookie, [
        item.entity_name,
      ]);
      db.prepare("DELETE FROM trash WHERE id = ?").run(item.id);
      db.prepare(
        "DELETE FROM sync_state WHERE entity_name = ? AND user_id = ?",
      ).run(item.entity_name, user.id);
      console.log(`Auto deleted: ${item.title}`);
    } catch (err) {
      console.error(`Failed to auto delete ${item.title}:`, err.message);
    }
  }
};

// Run scheduler every 24 hours
const startScheduler = () => {
  console.log("Scheduler started");

  // Run once on startup
  runScheduler();

  // Then every 24 hours
  setInterval(runScheduler, 24 * 60 * 60 * 1000);
};

module.exports = { startScheduler };
