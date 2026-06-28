const fs = require("fs");
const path = require("path");
const { listFiles, downloadFile, uploadFile, createFolder } = require("./api");
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
      // It's a folder — recurse into it
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
    // Skip hidden files and trash folder
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
const runSync = async () => {
  const db = getDatabase();
  const user = db.prepare("SELECT * FROM users LIMIT 1").get();

  if (!user) {
    console.log("No user found. Skipping sync.");
    return;
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

  // Build a map for quick lookup
  const remoteMap = {};
  for (const file of remoteFiles) {
    remoteMap[file.relativePath] = file;
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
  for (const state of syncStates) {
    stateMap[state.entity_name] = state;
  }

  // ─── Step 4: Remote → Local (download missing/changed) ─
  console.log("Checking remote → local...");
  for (const file of remoteFiles) {
    const localPath = path.join(sync_folder_path, file.relativePath);
    const existingState = stateMap[file.name];

    if (file.is_group) {
      // Create folder locally if it doesn't exist
      if (!fs.existsSync(localPath)) {
        fs.mkdirSync(localPath, { recursive: true });
        console.log(`Created folder: ${file.relativePath}`);
      }

      // Save folder to sync state
      saveSyncState(db, user.id, file, localPath, "synced");
      continue;
    }

    const localExists = fs.existsSync(localPath);

    if (!localExists) {
      // File missing locally → download it
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
    } else if (existingState && file.modified !== existingState.modified) {
      const localStat = fs.statSync(localPath);
      const localModifiedTime = localStat.mtime.toISOString();

      // Compare local modified time against what we last recorded
      const lastSynced = existingState.last_synced_at;
      const localChanged = localModifiedTime > lastSynced;
      const remoteChanged = file.modified !== existingState.modified;

      if (localChanged && remoteChanged) {
        // Both sides changed → conflict
        console.log(`Conflict detected: ${file.relativePath}`);

        // Save conflict to DB
        const existingConflict = db
          .prepare(
            "SELECT id FROM conflicts WHERE entity_name = ? AND user_id = ? AND status = ?",
          )
          .get(file.name, user.id, "pending");

        if (!existingConflict) {
          db.prepare(
            `
        INSERT INTO conflicts 
        (user_id, entity_name, title, local_path, local_modified, local_size, remote_modified, remote_size)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
          ).run(
            user.id,
            file.name,
            file.title,
            localPath,
            localModifiedTime,
            localStat.size,
            file.modified,
            file.file_size,
          );
        }

        // Update sync state to conflict
        saveSyncState(db, user.id, file, localPath, "conflict");
      } else if (remoteChanged && !localChanged) {
        // Only remote changed → download
        console.log(`Remote update: ${file.relativePath}`);
        await downloadFile(frappe_url, session_cookie, file.name, localPath);
        saveSyncState(db, user.id, file, localPath, "synced");
      }
    }
  }

  // ─── Step 5: Local → Remote (upload missing) ───────────
  console.log("Checking local → remote...");
  for (const [relativePath, localFile] of Object.entries(localFiles)) {
    const existsOnRemote = remoteFiles.find(
      (f) => f.relativePath === relativePath,
    );

    if (!existsOnRemote) {
      if (localFile.isFolder) {
        // Create folder on Frappe
        const parentPath = path.dirname(relativePath);
        const parentFolder = parentPath === "." ? remoteMap[parentPath] : null;
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
        // Upload file to Frappe
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

  // Update last synced timestamp
  db.prepare("UPDATE users SET last_synced_at = ? WHERE id = ?").run(
    new Date().toISOString(),
    user.id,
  );

  console.log("Sync complete.");
};

// ─── Helper: save or update sync state ────────────────────
const saveSyncState = (db, userId, file, localPath, status) => {
  const existing = db
    .prepare("SELECT id FROM sync_state WHERE entity_name = ?")
    .get(file.name);

  if (existing) {
    db.prepare(
      `
      UPDATE sync_state 
      SET title = ?, local_path = ?, modified = ?, file_size = ?, 
          status = ?, last_synced_at = CURRENT_TIMESTAMP
      WHERE entity_name = ?
    `,
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
      `
      INSERT INTO sync_state 
      (user_id, entity_name, title, local_path, modified, file_size, is_group, parent_drive_entity, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
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
