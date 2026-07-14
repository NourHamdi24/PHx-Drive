const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  Tray,
  Menu,
  nativeImage,
  shell,
} = require("electron");
const path = require("path");
const { getDatabase } = require("../src/db/database");
const {
  handleLogin,
  handleAutoLogin,
  handleLogout,
} = require("../src/auth/authHandler");
const { runSync, saveSyncState } = require("../src/sync/sync");
const { startWatcher, stopWatcher, markSyncWrite } = require("../src/sync/watcher");
const { startPolling, stopPolling } = require("../src/sync/poller");
const { startQueueProcessor } = require("../src/sync/queueProcessor");
const { getStatus, onStatusChange } = require("../src/sync/syncStatus");
let mainWindow = null;
let tray = null;

async function downloadEntityFile(db, user, entityName, state) {
  const fs = require("fs");
  const path = require("path");
  const { downloadFile } = require("../src/sync/api");

  fs.mkdirSync(path.dirname(state.local_path), { recursive: true });
  await downloadFile(
    user.frappe_url,
    user.session_cookie,
    entityName,
    state.local_path,
  );
  markSyncWrite(state.local_path);
  saveSyncState(
    db,
    user.id,
    {
      name: entityName,
      title: state.title,
      modified: state.modified,
      file_size: state.file_size,
      is_group: state.is_group,
      parent_drive_entity: state.parent_drive_entity,
    },
    state.local_path,
    "synced",
  );
}

const iconPath = app.isPackaged
  ? path.join(process.resourcesPath, "logo.png")
  : path.join(__dirname, "../build/logo.png");

const windowIconPath =
  process.platform === "win32"
    ? app.isPackaged
      ? path.join(process.resourcesPath, "logo.ico")
      : path.join(__dirname, "../build/logo.ico")
    : iconPath;

const guidePath = app.isPackaged
  ? path.join(process.resourcesPath, "Drive_Guide.pdf")
  : path.join(__dirname, "../build/Drive_Guide.pdf");

const trayStatusIconPath = (name) =>
  app.isPackaged
    ? path.join(process.resourcesPath, `${name}.png`)
    : path.join(__dirname, `../build/${name}.png`);

// Composites a small badge onto the bottom-right corner of a base icon,
// e.g. the app icon with a synced/syncing/error badge like OneDrive's tray icon.
const compositeBadge = (baseImage, badgeImage, size, badgeSize) => {
  const base = baseImage.resize({ width: size, height: size, quality: "best" });
  const badge = badgeImage.resize({
    width: badgeSize,
    height: badgeSize,
    quality: "best",
  });

  const baseBitmap = Buffer.from(base.toBitmap());
  const badgeBitmap = badge.toBitmap();
  const offset = size - badgeSize;

  for (let y = 0; y < badgeSize; y++) {
    for (let x = 0; x < badgeSize; x++) {
      const bIdx = (y * badgeSize + x) * 4;
      const alpha = badgeBitmap[bIdx + 3] / 255;
      if (alpha === 0) continue;

      const dIdx = ((offset + y) * size + (offset + x)) * 4;
      for (let c = 0; c < 3; c++) {
        baseBitmap[dIdx + c] = Math.round(
          badgeBitmap[bIdx + c] * alpha + baseBitmap[dIdx + c] * (1 - alpha),
        );
      }
      baseBitmap[dIdx + 3] = Math.round(
        badgeBitmap[bIdx + 3] + baseBitmap[dIdx + 3] * (1 - alpha),
      );
    }
  }

  return nativeImage.createFromBitmap(baseBitmap, { width: size, height: size });
};

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 760,
    minHeight: 560,
    title: "PHx Drive",
    icon: windowIconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  const isDev = !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  // Hide to tray instead of closing
  mainWindow.on("close", (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

app.whenReady().then(() => {
  const db = getDatabase();
  console.log("Database ready:", db.name);

  // ─── Auth ───────────────────────────────────────────────
  ipcMain.handle("auth:login", async (event, email, password) => {
    return await handleLogin(email, password);
  });

  ipcMain.handle("auth:autoLogin", async () => {
    return await handleAutoLogin();
  });

  ipcMain.handle("auth:logout", () => {
    stopWatcher();
    stopPolling();
    return handleLogout();
  });

  // ─── Folder Picker ──────────────────────────────────────
  ipcMain.handle("dialog:selectFolder", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
      title: "Choose your PHx Drive sync folder",
      buttonLabel: "Select Folder",
    });
    if (result.canceled) return null;
    return result.filePaths[0];
  });

  ipcMain.handle("auth:saveSyncFolder", (event, folderPath) => {
    const db = getDatabase();
    const user = db.prepare("SELECT * FROM users LIMIT 1").get();
    if (!user) return { success: false };
    db.prepare("UPDATE users SET sync_folder_path = ? WHERE id = ?").run(
      folderPath,
      user.id,
    );
    return { success: true, folderPath };
  });

  // ─── Sync ───────────────────────────────────────────────
  ipcMain.handle("sync:run", async () => {
    return await runSync({ manual: true });
  });

  ipcMain.handle("sync:startWatcher", () => {
    const db = getDatabase();
    const user = db.prepare("SELECT * FROM users LIMIT 1").get();
    if (!user || !user.sync_folder_path) return { success: false };

    startWatcher(user, (message) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("sync:log", message);
        if (message.includes("✅")) {
          mainWindow.webContents.send("sync:refresh");
        }
      }
    });
    return { success: true };
  });

  ipcMain.handle("sync:stopWatcher", () => {
    stopWatcher();
    return { success: true };
  });

  ipcMain.handle("sync:startPolling", () => {
    const db = getDatabase();
    const user = db.prepare("SELECT * FROM users LIMIT 1").get();
    if (!user) return { success: false };

    startPolling(
      (message) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("sync:log", message);
        }
      },
      () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("sync:refresh");
        }
      },
    );
    return { success: true };
  });

  ipcMain.handle("sync:stopPolling", () => {
    stopPolling();
    return { success: true };
  });

  // ─── Files ──────────────────────────────────────────────
  ipcMain.handle("files:list", async () => {
    const db = getDatabase();
    const user = db.prepare("SELECT * FROM users LIMIT 1").get();
    if (!user) return [];
    const { listFiles } = require("../src/sync/api");
    const remoteFiles = await listFiles(
      user.frappe_url,
      user.session_cookie,
      user.root_folder_id,
    );
    // Hide files that are locally deleted but not yet synced to remote
    const pendingDeletes = new Set(
      db
        .prepare(
          "SELECT entity_name FROM sync_state WHERE user_id = ? AND status = 'pending_delete'",
        )
        .all(user.id)
        .map((r) => r.entity_name),
    );
    return remoteFiles.filter((f) => !pendingDeletes.has(f.name));
  });

  ipcMain.handle("files:listWithStatus", async () => {
    const db = getDatabase();
    const user = db.prepare("SELECT * FROM users LIMIT 1").get();
    if (!user) return [];
    const { listAllRemoteFiles } = require("../src/sync/sync");
    const remoteFiles = await listAllRemoteFiles(
      user.frappe_url,
      user.session_cookie,
      user.root_folder_id,
    );
    const syncStates = db
      .prepare("SELECT * FROM sync_state WHERE user_id = ?")
      .all(user.id);
    const stateMap = {};
    const pendingDeletes = new Set();
    for (const s of syncStates) {
      stateMap[s.entity_name] = s;
      if (s.status === "pending_delete") pendingDeletes.add(s.entity_name);
    }
    const remoteList = remoteFiles
      .filter((f) => !pendingDeletes.has(f.name))
      .map((f) => ({
        ...f,
        syncStatus: stateMap[f.name]?.status || "pending",
      }));

    return remoteList;
  });

  ipcMain.handle("files:delete", async (event, entityName) => {
    const db = getDatabase();
    const user = db.prepare("SELECT * FROM users LIMIT 1").get();
    if (!user) return { success: false };

    const state = db
      .prepare("SELECT * FROM sync_state WHERE entity_name = ? AND user_id = ?")
      .get(entityName, user.id);

    // Delete local path immediately (file or folder)
    if (state?.local_path) {
      const fs = require("fs");
      if (fs.existsSync(state.local_path)) {
        const stat = fs.statSync(state.local_path);
        if (stat.isDirectory()) {
          fs.rmSync(state.local_path, { recursive: true, force: true });
        } else {
          fs.unlinkSync(state.local_path);
        }
      }
    }

    // Mark this entity and all descendants as pending_delete (both modes).
    // Hides them from the UI immediately; the actual remote delete is
    // handled by the watcher (auto) or the next Sync Now (manual).
    const markPendingDelete = (name) => {
      db.prepare(
        "UPDATE sync_state SET status = 'pending_delete' WHERE entity_name = ? AND user_id = ?",
      ).run(name, user.id);
      const children = db
        .prepare(
          "SELECT entity_name FROM sync_state WHERE parent_drive_entity = ? AND user_id = ?",
        )
        .all(name, user.id);
      for (const child of children) markPendingDelete(child.entity_name);
    };
    markPendingDelete(entityName);

    return { success: true };
  });

  ipcMain.handle("files:download", async (event, entityName) => {
    const db = getDatabase();
    const user = db.prepare("SELECT * FROM users LIMIT 1").get();
    if (!user) return { success: false };

    const state = db
      .prepare("SELECT * FROM sync_state WHERE entity_name = ? AND user_id = ?")
      .get(entityName, user.id);
    if (!state || !state.local_path) return { success: false };

    try {
      await downloadEntityFile(db, user, entityName, state);
      return { success: true };
    } catch (err) {
      console.error(`Failed to download ${entityName}:`, err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("files:open", async (event, entityName) => {
    const db = getDatabase();
    const user = db.prepare("SELECT * FROM users LIMIT 1").get();
    if (!user) return { success: false };

    const state = db
      .prepare("SELECT * FROM sync_state WHERE entity_name = ? AND user_id = ?")
      .get(entityName, user.id);
    if (!state || !state.local_path) return { success: false };

    const fs = require("fs");

    try {
      if (!fs.existsSync(state.local_path)) {
        await downloadEntityFile(db, user, entityName, state);
      }
      const error = await shell.openPath(state.local_path);
      if (error) return { success: false, error };
      return { success: true };
    } catch (err) {
      console.error(`Failed to open ${entityName}:`, err.message);
      return { success: false, error: err.message };
    }
  });

  // ─── Settings ───────────────────────────────────────────
  ipcMain.handle("settings:get", () => {
    const db = getDatabase();
    return db.prepare("SELECT * FROM users LIMIT 1").get() || null;
  });

  ipcMain.handle("settings:save", (event, settings) => {
    const db = getDatabase();
    const user = db.prepare("SELECT * FROM users LIMIT 1").get();
    if (!user) return { success: false };

    db.prepare(
      `
      UPDATE users SET
        sync_folder_path = ?,
        sync_mode = ?
      WHERE id = ?
    `,
    ).run(
      settings.sync_folder_path,
      settings.sync_mode,
      user.id,
    );

    if (settings.sync_mode === "auto") {
      startPolling(
        (message) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send("sync:log", message);
          }
        },
        () => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send("sync:refresh");
          }
        },
      );
    } else {
      stopPolling();
    }

    return { success: true };
  });

  ipcMain.handle("settings:setAutoStart", (event, enabled) => {
    app.setLoginItemSettings({ openAtLogin: enabled });
    return { success: true };
  });

  ipcMain.handle("settings:getAutoStart", () => {
    const { openAtLogin } = app.getLoginItemSettings();
    return openAtLogin;
  });

  ipcMain.handle("settings:getUserProfile", async () => {
    const db = getDatabase();
    const user = db.prepare("SELECT * FROM users LIMIT 1").get();
    if (!user) return null;
    const { getUserProfile } = require("../src/sync/api");
    try {
      return await getUserProfile(user.frappe_url, user.session_cookie, user.email);
    } catch (err) {
      console.error("Failed to fetch user profile:", err);
      return null;
    }
  });

  ipcMain.handle("settings:getUserRank", async () => {
    const db = getDatabase();
    const user = db.prepare("SELECT * FROM users LIMIT 1").get();
    if (!user) return null;
    const { getUserRank } = require("../src/sync/api");
    try {
      return await getUserRank(user.frappe_url, user.session_cookie, user.email);
    } catch (err) {
      console.error("Failed to fetch user rank:", err);
      return null;
    }
  });

  ipcMain.handle("settings:getEnergyPoints", async () => {
    const db = getDatabase();
    const user = db.prepare("SELECT * FROM users LIMIT 1").get();
    if (!user) return null;
    const { getEnergyPoints } = require("../src/sync/api");
    try {
      return await getEnergyPoints(user.frappe_url, user.session_cookie, user.email, 0, 20);
    } catch (err) {
      console.error("Failed to fetch energy points:", err);
      return null;
    }
  });

  // ─── System ─────────────────────────────────────────────
  ipcMain.handle("system:openExternal", (event, url) => {
    shell.openExternal(url);
  });

  ipcMain.handle("system:openGuide", () => {
    shell.openPath(guidePath);
  });

  // ─── System Tray ────────────────────────────────────────
  const trayBaseIcon = nativeImage.createFromPath(iconPath);
  const TRAY_ICON_SIZE = 32;
  const TRAY_BADGE_SIZE = 20;

  const trayStatusIcons = {
    synced: compositeBadge(
      trayBaseIcon,
      nativeImage.createFromPath(trayStatusIconPath("synced")),
      TRAY_ICON_SIZE,
      TRAY_BADGE_SIZE,
    ),
    syncing: compositeBadge(
      trayBaseIcon,
      nativeImage.createFromPath(trayStatusIconPath("syncing")),
      TRAY_ICON_SIZE,
      TRAY_BADGE_SIZE,
    ),
    error: compositeBadge(
      trayBaseIcon,
      nativeImage.createFromPath(trayStatusIconPath("error")),
      TRAY_ICON_SIZE,
      TRAY_BADGE_SIZE,
    ),
  };

  const trayStatusTooltips = {
    synced: "PHx Drive — Up to date",
    syncing: "PHx Drive — Syncing…",
    error: "PHx Drive — Sync error",
  };

  const applyTrayStatus = (status) => {
    if (!tray) return;
    tray.setImage(trayStatusIcons[status] || trayStatusIcons.synced);
    tray.setToolTip(trayStatusTooltips[status] || trayStatusTooltips.synced);
  };

  tray = new Tray(trayStatusIcons[getStatus()]);
  applyTrayStatus(getStatus());
  onStatusChange(applyTrayStatus);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Open PHx Drive",
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      },
    },
    {
      label: "Sync Now",
      click: async () => {
        await runSync();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("sync:refresh");
        }
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        app.isQuiting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on("click", () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // ─── Start Background Services ──────────────────────────
  startQueueProcessor();

  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    // Don't quit — keep running in tray
  }
});
