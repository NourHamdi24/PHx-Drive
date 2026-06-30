const chokidar = require("chokidar");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { uploadFile, createFolder, permanentDelete } = require("./api");
const { getDatabase } = require("../db/database");

let watcher = null;
const isAutoMode = () => {
  const db = getDatabase();
  const user = db.prepare("SELECT sync_mode FROM users LIMIT 1").get();
  return user?.sync_mode === "auto";
};
// Skip list — files Node itself is writing (to prevent upload loops)
const skipList = new Set();

const addToSkipList = (filePath) => skipList.add(filePath);
const removeFromSkipList = (filePath) => skipList.delete(filePath);

// ─── Save or update sync state ─────────────────────────────
const saveSyncState = (
  db,
  userId,
  entityName,
  title,
  localPath,
  modified,
  fileSize,
  isGroup,
  parentId,
  status,
) => {
  const existing = db
    .prepare("SELECT id FROM sync_state WHERE entity_name = ? AND user_id = ?")
    .get(entityName, userId);

  if (existing) {
    db.prepare(
      `
      UPDATE sync_state 
      SET title = ?, local_path = ?, modified = ?, file_size = ?,
          status = ?, last_synced_at = CURRENT_TIMESTAMP
      WHERE entity_name = ? AND user_id = ?
    `,
    ).run(title, localPath, modified, fileSize, status, entityName, userId);
  } else {
    db.prepare(
      `
      INSERT INTO sync_state 
      (user_id, entity_name, title, local_path, modified, file_size, is_group, parent_drive_entity, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    ).run(
      userId,
      entityName,
      title,
      localPath,
      modified,
      fileSize,
      isGroup,
      parentId,
      status,
    );
  }
};

// ─── Find remote parent folder ID ──────────────────────────
const getRemoteParentId = (db, userId, relativePath, rootFolderId) => {
  if (!relativePath || relativePath === ".") return rootFolderId;

  const parentState = db
    .prepare(
      `
    SELECT entity_name FROM sync_state 
    WHERE local_path LIKE ? AND is_group = 1 AND user_id = ?
  `,
    )
    .get(`%${path.basename(relativePath)}`, userId);

  return parentState ? parentState.entity_name : rootFolderId;
};

// ─── Start The Watcher ─────────────────────────────────────
const startWatcher = (user, emitLog) => {
  const {
    frappe_url,
    session_cookie,
    root_folder_id,
    sync_folder_path,
    id: userId,
  } = user;

  // Close existing watcher if running
  if (watcher) {
    watcher.close();
    watcher = null;
  }

  console.log("Starting watcher on:", sync_folder_path);
  emitLog("Watcher started");

  watcher = chokidar.watch(sync_folder_path, {
    ignoreInitial: true,
    ignored: /(^|[\/\\])\../, // ignore hidden files
    persistent: true,
    awaitWriteFinish: {
      stabilityThreshold: 1000,
      pollInterval: 100,
    },
  });

  // ─── File Added ──────────────────────────────────────────
  watcher.on("add", async (filePath) => {
    if (!isAutoMode()) return;
    if (skipList.has(filePath)) return;
    if (skipList.has(filePath)) return;

    const db = getDatabase();
    const relativePath = path
      .relative(sync_folder_path, filePath)
      .replace(/\\/g, "/");
    console.log(`New local file: ${relativePath}`);
    emitLog(`Uploading: ${path.basename(filePath)}`);

    try {
      const parentRelative = path.dirname(relativePath);
      const parentId = getRemoteParentId(
        db,
        userId,
        parentRelative,
        root_folder_id,
      );
      const stat = fs.statSync(filePath);

      const uploaded = await uploadFile(
        frappe_url,
        session_cookie,
        filePath,
        path.basename(filePath),
        parentId,
      );

      saveSyncState(
        db,
        userId,
        uploaded.name,
        path.basename(filePath),
        filePath,
        uploaded.modified || new Date().toISOString(),
        stat.size,
        0,
        parentId,
        "synced",
      );

      emitLog(`Uploaded: ${path.basename(filePath)} ✅`);
      console.log(`Uploaded: ${relativePath}`);
    } catch (err) {
      emitLog(`Upload failed: ${path.basename(filePath)} ❌`);
      console.error(`Upload failed for ${relativePath}:`, err.message);

      // Save to queue for retry
      const db2 = getDatabase();
      db2
        .prepare(
          `
        INSERT INTO sync_queue (user_id, local_path, action, status)
        VALUES (?, ?, 'upload', 'pending')
      `,
        )
        .run(userId, filePath);
    }
  });

  // ─── File Changed ────────────────────────────────────────
  watcher.on("change", async (filePath) => {
    if (!isAutoMode()) return;
    if (skipList.has(filePath)) return;
    if (skipList.has(filePath)) return;

    const db = getDatabase();
    const relativePath = path
      .relative(sync_folder_path, filePath)
      .replace(/\\/g, "/");
    console.log(`File changed: ${relativePath}`);
    emitLog(`Updating: ${path.basename(filePath)}`);

    try {
      // Find existing sync state to get entity_name and parent
      const existingState = db
        .prepare(
          "SELECT * FROM sync_state WHERE local_path = ? AND user_id = ?",
        )
        .get(filePath, userId);

      const parentId = existingState
        ? existingState.parent_drive_entity
        : getRemoteParentId(
            db,
            userId,
            path.dirname(relativePath),
            root_folder_id,
          );

      const stat = fs.statSync(filePath);

      const uploaded = await uploadFile(
        frappe_url,
        session_cookie,
        filePath,
        path.basename(filePath),
        parentId,
      );

      saveSyncState(
        db,
        userId,
        uploaded.name,
        path.basename(filePath),
        filePath,
        uploaded.modified || new Date().toISOString(),
        stat.size,
        0,
        parentId,
        "synced",
      );

      emitLog(`Updated: ${path.basename(filePath)} ✅`);
      console.log(`Updated: ${relativePath}`);
    } catch (err) {
      emitLog(`Update failed: ${path.basename(filePath)} ❌`);
      console.error(`Update failed for ${relativePath}:`, err.message);
    }
  });

  // ─── File Deleted ────────────────────────────────────────
  watcher.on("unlink", async (filePath) => {
    if (!isAutoMode()) return;
    if (skipList.has(filePath)) return;
    if (skipList.has(filePath)) return;

    const db = getDatabase();
    const relativePath = path
      .relative(sync_folder_path, filePath)
      .replace(/\\/g, "/");
    console.log(`File deleted locally: ${relativePath}`);
    emitLog(`Deleting: ${path.basename(filePath)}`);

    try {
      // Find the entity in sync state
      const existingState = db
        .prepare(
          "SELECT * FROM sync_state WHERE local_path = ? AND user_id = ?",
        )
        .get(filePath, userId);

      if (!existingState) {
        console.log(`No sync state found for deleted file: ${relativePath}`);
        return;
      }

      // Permanently delete on Frappe
      await permanentDelete(frappe_url, session_cookie, [
        existingState.entity_name,
      ]);

      // Remove from sync state entirely
      db.prepare(
        "DELETE FROM sync_state WHERE entity_name = ? AND user_id = ?",
      ).run(existingState.entity_name, userId);

      emitLog(`Deleted: ${path.basename(filePath)} ✅`);
      console.log(`Trashed on Frappe: ${relativePath}`);
    } catch (err) {
      emitLog(`Delete failed: ${path.basename(filePath)} ❌`);
      console.error(`Delete failed for ${relativePath}:`, err.message);
    }
  });

  // ─── Folder Added ────────────────────────────────────────
  watcher.on("addDir", async (dirPath) => {
    if (!isAutoMode()) return;
    if (dirPath === sync_folder_path) return;
    if (dirPath === sync_folder_path) return; // ignore root folder
    if (skipList.has(dirPath)) return;

    const db = getDatabase();
    const relativePath = path
      .relative(sync_folder_path, dirPath)
      .replace(/\\/g, "/");
    console.log(`New local folder: ${relativePath}`);
    emitLog(`Creating folder: ${path.basename(dirPath)}`);

    try {
      const parentRelative = path.dirname(relativePath);
      const parentId = getRemoteParentId(
        db,
        userId,
        parentRelative,
        root_folder_id,
      );

      const created = await createFolder(
        frappe_url,
        session_cookie,
        path.basename(dirPath),
        parentId,
      );

      saveSyncState(
        db,
        userId,
        created.name,
        path.basename(dirPath),
        dirPath,
        new Date().toISOString(),
        null,
        1,
        parentId,
        "synced",
      );

      emitLog(`Folder created: ${path.basename(dirPath)} ✅`);
    } catch (err) {
      emitLog(`Folder creation failed: ${path.basename(dirPath)} ❌`);
      console.error(`Folder creation failed for ${relativePath}:`, err.message);
    }
  });

  watcher.on("error", (err) => {
    console.error("Watcher error:", err);
    emitLog(`Watcher error: ${err.message}`);
  });

  return watcher;
};

const stopWatcher = () => {
  if (watcher) {
    watcher.close();
    watcher = null;
    console.log("Watcher stopped");
  }
};

module.exports = {
  startWatcher,
  stopWatcher,
  addToSkipList,
  removeFromSkipList,
};
