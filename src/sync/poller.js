const { runSync } = require("./sync");
const { getDatabase } = require("../db/database");
const { withSyncLock } = require("./syncLock");

let pollingTimer = null;
let isPolling = false;

const POLL_INTERVAL_MS = 5000;

const startPolling = (emitLog, onRefresh) => {
  console.log("Polling service started");

  // Run immediately
  runPoll(emitLog, onRefresh);

  // Then poll every 5 seconds
  pollingTimer = setInterval(() => {
    runPoll(emitLog, onRefresh);
  }, POLL_INTERVAL_MS);
};

const runPoll = async (emitLog, onRefresh) => {
  // A previous tick's runSync (or the wait for the shared sync lock) is
  // still in flight — skip this tick instead of piling up overlapping
  // full syncs that race each other over the same sync_state rows.
  if (isPolling) return;

  const db = getDatabase();
  const user = db.prepare("SELECT * FROM users LIMIT 1").get();

  if (!user || user.sync_mode === "manual") return;

  isPolling = true;
  try {
    console.log("Polling Frappe for changes...");
    emitLog("Checking for remote changes...");
    await withSyncLock(() => runSync());
    emitLog("Remote check complete ✅");
    if (onRefresh) onRefresh();
  } catch (err) {
    console.error("Polling error:", err.message);
    emitLog(`Remote check failed ❌`);
  } finally {
    isPolling = false;
  }
};

const stopPolling = () => {
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
    console.log("Polling stopped");
  }
};

module.exports = { startPolling, stopPolling };
