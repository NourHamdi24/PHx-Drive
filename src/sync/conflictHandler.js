const fs = require("fs");
const path = require("path");
const { downloadFile, uploadFile } = require("./api");
const { getDatabase } = require("../db/database");

const resolveKeepLocal = async (conflictId) => {
  const db = getDatabase();
  const conflict = db
    .prepare("SELECT * FROM conflicts WHERE id = ?")
    .get(conflictId);
  if (!conflict) throw new Error("Conflict not found");

  const user = db
    .prepare("SELECT * FROM users WHERE id = ?")
    .get(conflict.user_id);

  console.log(`Resolving conflict (keep local): ${conflict.title}`);

  // Upload local version to Frappe — overwrites remote
  await uploadFile(
    user.frappe_url,
    user.session_cookie,
    conflict.local_path,
    conflict.title,
    null, // will use existing parent
  );

  // Update sync state to synced
  db.prepare(
    `
    UPDATE sync_state SET status = 'synced', last_synced_at = CURRENT_TIMESTAMP
    WHERE entity_name = ? AND user_id = ?
  `,
  ).run(conflict.entity_name, conflict.user_id);

  // Mark conflict as resolved
  db.prepare("UPDATE conflicts SET status = ? WHERE id = ?").run(
    "resolved_local",
    conflictId,
  );

  return { success: true };
};

const resolveKeepFrappe = async (conflictId) => {
  const db = getDatabase();
  const conflict = db
    .prepare("SELECT * FROM conflicts WHERE id = ?")
    .get(conflictId);
  if (!conflict) throw new Error("Conflict not found");

  const user = db
    .prepare("SELECT * FROM users WHERE id = ?")
    .get(conflict.user_id);

  console.log(`Resolving conflict (keep frappe): ${conflict.title}`);

  // Download Frappe version — overwrites local
  await downloadFile(
    user.frappe_url,
    user.session_cookie,
    conflict.entity_name,
    conflict.local_path,
  );

  // Update sync state
  db.prepare(
    `
    UPDATE sync_state SET status = 'synced', last_synced_at = CURRENT_TIMESTAMP
    WHERE entity_name = ? AND user_id = ?
  `,
  ).run(conflict.entity_name, conflict.user_id);

  // Mark conflict resolved
  db.prepare("UPDATE conflicts SET status = ? WHERE id = ?").run(
    "resolved_frappe",
    conflictId,
  );

  return { success: true };
};

const resolveKeepBoth = async (conflictId) => {
  const db = getDatabase();
  const conflict = db
    .prepare("SELECT * FROM conflicts WHERE id = ?")
    .get(conflictId);
  if (!conflict) throw new Error("Conflict not found");

  const user = db
    .prepare("SELECT * FROM users WHERE id = ?")
    .get(conflict.user_id);

  console.log(`Resolving conflict (keep both): ${conflict.title}`);

  // Rename local file to a conflicted copy
  const ext = path.extname(conflict.local_path);
  const base = path.basename(conflict.local_path, ext);
  const dir = path.dirname(conflict.local_path);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const conflictedCopyPath = path.join(
    dir,
    `${base} (conflicted ${timestamp})${ext}`,
  );

  // Copy local file to conflicted name
  fs.copyFileSync(conflict.local_path, conflictedCopyPath);

  // Download Frappe version to original path
  await downloadFile(
    user.frappe_url,
    user.session_cookie,
    conflict.entity_name,
    conflict.local_path,
  );

  // Upload the conflicted copy as a new file
  await uploadFile(
    user.frappe_url,
    user.session_cookie,
    conflictedCopyPath,
    path.basename(conflictedCopyPath),
    null,
  );

  // Update sync state
  db.prepare(
    `
    UPDATE sync_state SET status = 'synced', last_synced_at = CURRENT_TIMESTAMP
    WHERE entity_name = ? AND user_id = ?
  `,
  ).run(conflict.entity_name, conflict.user_id);

  // Mark conflict resolved
  db.prepare("UPDATE conflicts SET status = ? WHERE id = ?").run(
    "resolved_both",
    conflictId,
  );

  return { success: true };
};

const listConflicts = (userId) => {
  const db = getDatabase();
  return db
    .prepare(
      "SELECT * FROM conflicts WHERE user_id = ? AND status = ? ORDER BY created_at DESC",
    )
    .all(userId, "pending");
};

module.exports = {
  resolveKeepLocal,
  resolveKeepFrappe,
  resolveKeepBoth,
  listConflicts,
};
