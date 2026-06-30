const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  Tray,
  Menu,
  nativeImage,
} = require("electron");
const path = require("path");
const { getDatabase } = require("../src/db/database");
const {
  handleLogin,
  handleAutoLogin,
  handleLogout,
} = require("../src/auth/authHandler");
const { runSync } = require("../src/sync/sync");
const { startWatcher, stopWatcher } = require("../src/sync/watcher");
const { startPolling, stopPolling } = require("../src/sync/poller");
const { startScheduler } = require("../src/sync/scheduler");
const { startQueueProcessor } = require("../src/sync/queueProcessor");
let mainWindow = null;
let tray = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "PHx Drive",
    icon: path.join(__dirname, "../build/logo.png"),
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

  ipcMain.handle(
    "sync:resolveRemoteDeletion",
    async (event, entityName, decision) => {
      const db = getDatabase();
      const user = db.prepare("SELECT * FROM users LIMIT 1").get();
      if (!user) return { success: false };

      const state = db
        .prepare(
          "SELECT * FROM sync_state WHERE entity_name = ? AND user_id = ?",
        )
        .get(entityName, user.id);

      if (decision === "restore") {
        // Restore from remote trash, then re-download locally
        const { trashOrRestore, downloadFile } = require("../src/sync/api");
        await trashOrRestore(user.frappe_url, user.session_cookie, [
          entityName,
        ]);
        if (state?.local_path) {
          const fs = require("fs");
          const path = require("path");
          fs.mkdirSync(path.dirname(state.local_path), { recursive: true });
          await downloadFile(
            user.frappe_url,
            user.session_cookie,
            entityName,
            state.local_path,
          );
        }
        db.prepare(
          "UPDATE sync_state SET status = 'synced' WHERE entity_name = ? AND user_id = ?",
        ).run(entityName, user.id);
      } else {
        // "deleteLocally" — delete local copy; remote stays in trash
        const fs = require("fs");
        if (state?.local_path && fs.existsSync(state.local_path)) {
          fs.unlinkSync(state.local_path);
        }
        db.prepare(
          "DELETE FROM sync_state WHERE entity_name = ? AND user_id = ?",
        ).run(entityName, user.id);
      }

      return { success: true };
    },
  );

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

  ipcMain.handle("files:shareLink", (event, entityName) => {
    const db = getDatabase();
    const user = db.prepare("SELECT * FROM users LIMIT 1").get();
    const { getShareLink } = require("../src/sync/api");
    return getShareLink(user.frappe_url, entityName);
  });

  ipcMain.handle("files:listWithStatus", async () => {
    const db = getDatabase();
    const user = db.prepare("SELECT * FROM users LIMIT 1").get();
    if (!user) return [];
    const { listFiles } = require("../src/sync/api");
    const remoteFiles = await listFiles(
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
    return remoteFiles
      .filter((f) => !pendingDeletes.has(f.name))
      .map((f) => ({
        ...f,
        syncStatus: stateMap[f.name]?.status || "pending",
      }));
  });

  ipcMain.handle("trash:count", () => {
    const db = getDatabase();
    const user = db.prepare("SELECT * FROM users LIMIT 1").get();
    if (!user) return 0;
    const row = db
      .prepare("SELECT COUNT(*) as count FROM trash WHERE user_id = ?")
      .get(user.id);
    return row?.count || 0;
  });

  ipcMain.handle("files:trash", async (event, entityName) => {
    const db = getDatabase();
    const user = db.prepare("SELECT * FROM users LIMIT 1").get();
    if (!user) return { success: false };

    const state = db
      .prepare("SELECT * FROM sync_state WHERE entity_name = ? AND user_id = ?")
      .get(entityName, user.id);

    // Delete local file immediately
    if (state?.local_path) {
      const fs = require("fs");
      if (fs.existsSync(state.local_path)) {
        fs.unlinkSync(state.local_path);
      }
    }

    if (user.sync_mode === "auto") {
      // Auto mode: the file watcher detects the deletion and handles the remote delete.
      // Nothing more to do here.
    } else {
      // Manual mode: queue the remote permanent delete for the next Sync Now.
      db.prepare(
        "UPDATE sync_state SET status = 'pending_delete' WHERE entity_name = ? AND user_id = ?",
      ).run(entityName, user.id);
    }

    return { success: true };
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
        sync_mode = ?,
        sync_interval = ?
      WHERE id = ?
    `,
    ).run(
      settings.sync_folder_path,
      settings.sync_mode,
      settings.sync_interval,
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

  // ─── System Tray ────────────────────────────────────────
  const trayIcon = nativeImage
    .createFromPath(path.join(__dirname, "../build/logo.png"))
    .resize({ width: 16, height: 16, quality: "best" });

  tray = new Tray(trayIcon);

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

  tray.setToolTip("PHx Drive");
  tray.setContextMenu(contextMenu);

  tray.on("click", () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // ─── Start Background Services ──────────────────────────
  startScheduler();
  startQueueProcessor();

  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    // Don't quit — keep running in tray
  }
});
