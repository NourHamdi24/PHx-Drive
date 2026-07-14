const { runSync } = require("./sync");
const { getDatabase } = require("../db/database");

let pollingTimer = null;

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
  const db = getDatabase();
  const user = db.prepare("SELECT * FROM users LIMIT 1").get();

  if (!user || user.sync_mode === "manual") return;

  try {
    console.log("Polling Frappe for changes...");
    emitLog("Checking for remote changes...");
    await runSync();
    emitLog("Remote check complete ✅");
    if (onRefresh) onRefresh();
  } catch (err) {
    console.error("Polling error:", err.message);
    emitLog(`Remote check failed ❌`);
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
