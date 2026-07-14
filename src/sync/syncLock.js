// ─── Global sync mutex ──────────────────────────────────────
// Serializes every operation that reads/writes sync_state or touches the
// sync folder (full resync, watcher events, queued retries, manual
// downloads/sync-now) so two of them never run at once. Without this, a
// periodic auto-sync pass can start reading remote/local state while a
// user action (e.g. a download) is only half-applied, and misread it as a
// remote deletion or a local edit.
let lockChain = Promise.resolve();

const withSyncLock = (fn) => {
  const run = lockChain.then(fn, fn);
  lockChain = run.then(
    () => {},
    () => {},
  );
  return run;
};

module.exports = { withSyncLock };
