const { EventEmitter } = require("events");

const emitter = new EventEmitter();
let activeCount = 0;
let hasError = false;

const getStatus = () => {
  if (activeCount > 0) return "syncing";
  if (hasError) return "error";
  return "synced";
};

const emitStatus = () => emitter.emit("status", getStatus());

const beginActivity = () => {
  activeCount++;
  emitStatus();
};

const endActivity = () => {
  activeCount = Math.max(0, activeCount - 1);
  emitStatus();
};

const reportError = () => {
  hasError = true;
  emitStatus();
};

const clearError = () => {
  hasError = false;
  emitStatus();
};

const onStatusChange = (listener) => {
  emitter.on("status", listener);
  return () => emitter.off("status", listener);
};

module.exports = {
  getStatus,
  beginActivity,
  endActivity,
  reportError,
  clearError,
  onStatusChange,
};
