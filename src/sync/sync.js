const fs = require("fs");
const path = require("path");
const {
  listFiles,
  downloadFile,
  uploadFile,
  createFolder,
  permanentDelete,
  listTrashedFiles,
} = require("./api");
const { getDatabase } = require("../db/database");

// ─── List all files from Frappe recursively ────────────────
const listAllRemoteFiles = async (
  frappUrl,
  sessionCookie,
  folderId,
  remotePath = "",
) => {
  const items = await listFiles(frappUrl, sessionCookie, folderId);
  let allFiles = [];

  for (const item of items) {
    const itemPath = remotePath ? `${remotePath}/${item.title}` : item.title;

    if (item.is_group) {
      const children = await listAllRemoteFiles(
        frappUrl,
        sessionCookie,
        item.name,
        itemPath,
      );
      allFiles.push({ ...item, relativePath: itemPath });
      allFiles = allFiles.concat(children);
    } else {
      allFiles.push({ ...item, relativePath: itemPath });
    }
  }

  return allFiles;
};

// ─── List all files locally recursively ───────────────────
const listAllLocalFiles = (syncFolder, dir = syncFolder) => {
  const files = {};

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;

    const fullPath = path.join(dir, entry.name);
    const relativePath = path
      .relative(syncFolder, fullPath)
      .replace(/\\/g, "/");

    if (entry.isDirectory()) {
      Object.assign(files, listAllLocalFiles(syncFolder, fullPath));
      files[relativePath] = { isFolder: true, fullPath };
    } else {
      const stat = fs.statSync(fullPath);
      files[relativePath] = {
        isFolder: false,
        fullPath,
        size: stat.size,
        modified: stat.mtime.toISOString(),
      };
    }
  }

  return files;
};

// ─── Core sync function ────────────────────────────────────
const runSync = async ({ manual = false } = {}) => {
  const db = getDatabase();
  const user = db.prepare("SELECT * FROM users LIMIT 1").get();

  if (!user) {
    console.log("No user found. Skipping sync.");
    return { remoteTrashWarnings: [] };
  }

  const { frappe_url, session_cookie, root_folder_id, sync_folder_path } = user;
  console.log("Starting sync...");
  console.log("Sync folder:", sync_folder_path);

  // ─── Step 1: List remote files ──────────────────────────
  console.log("Fetching remote files...");
  const remoteFiles = await listAllRemoteFiles(
    frappe_url,
    session_cookie,
    root_folder_id,
  );
  console.log(`Found ${remoteFiles.length} remote items`);

  const remoteMap = {};
  const remoteByEntityName = new Set();
  for (const file of remoteFiles) {
    remoteMap[file.relativePath] = file;
    remoteByEntityName.add(file.name);
  }

  // ─── Step 2: List local files ───────────────────────────
  console.log("Scanning local files...");
  const localFiles = listAllLocalFiles(sync_folder_path);
  console.log(`Found ${Object.keys(localFiles).length} local items`);

  // ─── Step 3: Get sync state from DB ────────────────────
  const syncStates = db
    .prepare("SELECT * FROM sync_state WHERE user_id = ?")
    .all(user.id);
  const stateMap = {};
  const localPathStateMap = {};
  for (const state of syncStates) {
    stateMap[state.entity_name] = state;
    if (state.local_path) localPathStateMap[state.local_path] = state;
  }

  // ─── Step 3.5: Push local deletions to remote ──────────
  // Covers two cases:
  //   'pending_delete' — file was deleted via the app UI in manual mode
  //   'synced' with missing file — file was removed from disk since last sync (manual mode)
  // In auto mode the watcher handles this in real-time; this step is a safety net.
  const locallyDeletedEntities = new Set();
  for (const state of syncStates) {
    if (!state.local_path) continue;
    const isPendingDelete = state.status === "pending_delete";
    const isGoneFromDisk =
      state.status === "synced" && !fs.existsSync(state.local_path);
    if (!isPendingDelete && !isGoneFromDisk) continue;

    console.log(`Local deletion detected: ${state.title}`);
    if (remoteByEntityName.has(state.entity_name)) {
      try {
        await permanentDelete(frappe_url, session_cookie, [state.entity_name]);
        console.log(`Permanently deleted remotely: ${state.title}`);
      } catch (err) {
        console.error(
          `Failed remote permanent delete of ${state.entity_name}:`,
          err.message,
        );
      }
    }
    db.prepare(
      "DELETE FROM sync_state WHERE entity_name = ? AND user_id = ?",
    ).run(state.entity_name, user.id);
    locallyDeletedEntities.add(state.entity_name);
  }

  // ─── Step 4: Remote → Local (download missing/changed) ─
  console.log("Checking remote → local...");
  for (const file of remoteFiles) {
    if (locallyDeletedEntities.has(file.name)) continue;

    const localPath = path.join(sync_folder_path, file.relativePath);
    const existingState = stateMap[file.name];

    if (file.is_group) {
      if (!fs.existsSync(localPath)) {
        fs.mkdirSync(localPath, { recursive: true });
        console.log(`Created folder: ${file.relativePath}`);
      }
      saveSyncState(db, user.id, file, localPath, "synced");
      continue;
    }

    const localExists = fs.existsSync(localPath);

    if (!localExists) {
      console.log(`Downloading: ${file.relativePath}`);
      fs.mkdirSync(path.dirname(localPath), { recursive: true });
      if (!file.mime_type && file.file_kind === "Document" && !file.file_ext) {
        console.log(
          `Skipping Drive document (not downloadable): ${file.relativePath}`,
        );
        continue;
      }
      await downloadFile(frappe_url, session_cookie, file.name, localPath);
      saveSyncState(db, user.id, file, localPath, "synced");
    } else if (existingState) {
      const localStat = fs.statSync(localPath);
      const localModifiedTime = localStat.mtime.toISOString();
      const lastSynced = existingState.last_synced_at;
      const localChanged = localModifiedTime > lastSynced;
      const remoteChanged = file.modified !== existingState.modified;

      if (remoteChanged && !localChanged) {
        console.log(`Remote update: ${file.relativePath}`);
        await downloadFile(frappe_url, session_cookie, file.name, localPath);
        saveSyncState(db, user.id, file, localPath, "synced");
      } else if (localChanged && !remoteChanged) {
        console.log(`Local edit detected, replacing remote: ${file.relativePath}`);
        try {
          await permanentDelete(frappe_url, session_cookie, [file.name]);
        } catch (err) {
          console.error(`Failed to delete old remote for ${file.relativePath}:`, err.message);
        }
        const parentId = existingState.parent_drive_entity || root_folder_id;
        const uploaded = await uploadFile(
          frappe_url,
          session_cookie,
          localPath,
          path.basename(localPath),
          parentId,
        );
        db.prepare(
          "DELETE FROM sync_state WHERE entity_name = ? AND user_id = ?",
        ).run(file.name, user.id);
        saveSyncState(db, user.id, {
          name: uploaded.name,
          title: path.basename(localPath),
          relativePath: file.relativePath,
          modified: uploaded.modified || new Date().toISOString(),
          file_size: localStat.size,
          is_group: 0,
          parent_drive_entity: parentId,
        }, localPath, "synced");
        console.log(`Re-uploaded local edit: ${file.relativePath}`);
      }
    }
  }

  // ─── Step 5: Local → Remote (upload new; skip remote-deleted) ──
  console.log("Checking local → remote...");
  for (const [relativePath, localFile] of Object.entries(localFiles)) {
    const existsOnRemote = remoteFiles.find(
      (f) => f.relativePath === relativePath,
    );

    if (!existsOnRemote) {
      const prevState = localPathStateMap[localFile.fullPath];

      if (prevState) {
        // File was previously known — remote side no longer has it.
        // Mark as remote_deleted; do NOT upload (remote deletion doesn't affect local).
        if (prevState.status === "synced") {
          db.prepare(
            "UPDATE sync_state SET status = 'remote_deleted' WHERE entity_name = ? AND user_id = ?",
          ).run(prevState.entity_name, user.id);
        }
        continue;
      }

      if (localFile.isFolder) {
        const parentPath = path.dirname(relativePath);
        const parentFolder = parentPath === "." ? null : remoteMap[parentPath];
        const parentId = parentFolder ? parentFolder.name : root_folder_id;

        console.log(`Creating remote folder: ${relativePath}`);
        const created = await createFolder(
          frappe_url,
          session_cookie,
          path.basename(relativePath),
          parentId,
        );
        saveSyncState(
          db,
          user.id,
          {
            name: created.name,
            title: path.basename(relativePath),
            relativePath,
            modified: new Date().toISOString(),
            file_size: null,
            is_group: 1,
            parent_drive_entity: parentId,
          },
          localFile.fullPath,
          "synced",
        );
      } else {
        const parentPath = path.dirname(relativePath);
        const parentFolder = parentPath === "." ? null : remoteMap[parentPath];
        const parentId = parentFolder ? parentFolder.name : root_folder_id;

        console.log(`Uploading: ${relativePath}`);
        const uploaded = await uploadFile(
          frappe_url,
          session_cookie,
          localFile.fullPath,
          path.basename(relativePath),
          parentId,
        );

        saveSyncState(
          db,
          user.id,
          {
            name: uploaded.name,
            title: path.basename(relativePath),
            relativePath,
            modified: uploaded.modified || new Date().toISOString(),
            file_size: localFile.size,
            is_group: 0,
            parent_drive_entity: parentId,
          },
          localFile.fullPath,
          "synced",
        );
      }
    }
  }

  // ─── Update last synced timestamp ──────────────────────
  db.prepare("UPDATE users SET last_synced_at = ? WHERE id = ?").run(
    new Date().toISOString(),
    user.id,
  );

  // ─── Step 6 (manual Sync Now only): Warn about remote-trashed files ──
  // Check if any locally-present files are sitting in remote trash.
  let remoteTrashWarnings = [];
  if (manual) {
    console.log("Checking remote trash for warnings...");
    try {
      const trashedRemoteFiles = await listTrashedFiles(frappe_url, session_cookie);
      const remoteTrashedSet = new Set(trashedRemoteFiles.map((f) => f.name));

      const remoteDeletedStates = db
        .prepare(
          "SELECT * FROM sync_state WHERE user_id = ? AND status = 'remote_deleted'",
        )
        .all(user.id);

      for (const state of remoteDeletedStates) {
        if (
          remoteTrashedSet.has(state.entity_name) &&
          state.local_path &&
          fs.existsSync(state.local_path)
        ) {
          remoteTrashWarnings.push({
            entityName: state.entity_name,
            title: state.title,
            localPath: state.local_path,
          });
        }
      }
    } catch (err) {
      console.error("Failed to fetch remote trash for warnings:", err.message);
    }
  }

  console.log("Sync complete.");
  return { remoteTrashWarnings };
};

// ─── Helper: save or update sync state ────────────────────
const saveSyncState = (db, userId, file, localPath, status) => {
  const existing = db
    .prepare("SELECT id FROM sync_state WHERE entity_name = ?")
    .get(file.name);

  if (existing) {
    db.prepare(
      `UPDATE sync_state
       SET title = ?, local_path = ?, modified = ?, file_size = ?,
           status = ?, last_synced_at = CURRENT_TIMESTAMP
       WHERE entity_name = ?`,
    ).run(
      file.title,
      localPath,
      file.modified,
      file.file_size,
      status,
      file.name,
    );
  } else {
    db.prepare(
      `INSERT INTO sync_state
       (user_id, entity_name, title, local_path, modified, file_size, is_group, parent_drive_entity, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      userId,
      file.name,
      file.title,
      localPath,
      file.modified,
      file.file_size,
      file.is_group,
      file.parent_drive_entity,
      status,
    );
  }
};

module.exports = { runSync, listAllRemoteFiles, listAllLocalFiles };
