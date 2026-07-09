const { runSync } = require("./sync");
const { getDatabase } = require("../db/database");

let pollingTimer = null;

const startPolling = (emitLog, onRefresh) => {
  console.log("Polling service started");

  // Run immediately
  runPoll(emitLog, onRefresh);

  // Then check every 5 seconds if we should poll
  pollingTimer = setInterval(() => {
    const db = getDatabase();
    const user = db.prepare("SELECT * FROM users LIMIT 1").get();

    if (!user) return;
    if (user.sync_mode === "manual") return;

    runPoll(emitLog, onRefresh);
  }, 5000); // check every 5 seconds, respects user's sync_interval inside runPoll
};
let lastPollTime = 0;

const runPoll = async (emitLog, onRefresh) => {
  const db = getDatabase();
  const user = db.prepare("SELECT * FROM users LIMIT 1").get();

  if (!user || user.sync_mode === "manual") return;

  const interval = (user.sync_interval || 30) * 1000;
  const now = Date.now();

  // Only poll if enough time has passed since last poll
  if (now - lastPollTime < interval) return;
  lastPollTime = now;

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
