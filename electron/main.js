const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const { getDatabase } = require("../src/db/database");
const {
  handleLogin,
  handleAutoLogin,
  handleLogout,
} = require("../src/auth/authHandler");
const { runSync } = require("../src/sync/sync");
const { startWatcher, stopWatcher } = require("../src/sync/watcher");
const { stopPolling, startPolling } = require("../src/sync/poller");
const {
  resolveKeepBoth,
  resolveKeepFrappe,
  resolveKeepLocal,
} = require("../src/sync/conflictHandler");

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
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
    return await runSync();
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

  // ─── Files ──────────────────────────────────────────────
  ipcMain.handle("files:list", async () => {
    const db = getDatabase();
    const user = db.prepare("SELECT * FROM users LIMIT 1").get();
    if (!user) return [];

    const { listFiles } = require("../src/sync/api");
    return await listFiles(
      user.frappe_url,
      user.session_cookie,
      user.root_folder_id,
    );
  });

  ipcMain.handle("files:shareLink", (event, entityName) => {
    const db = getDatabase();
    const user = db.prepare("SELECT * FROM users LIMIT 1").get();
    const { getShareLink } = require("../src/sync/api");
    return getShareLink(user.frappe_url, entityName);
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
  ipcMain.handle("conflicts:list", () => {
    const db = getDatabase();
    const user = db.prepare("SELECT * FROM users LIMIT 1").get();
    if (!user) return [];
    return listConflicts(user.id);
  });

  ipcMain.handle("conflicts:keepLocal", async (event, conflictId) => {
    return await resolveKeepLocal(conflictId);
  });

  ipcMain.handle("conflicts:keepFrappe", async (event, conflictId) => {
    return await resolveKeepFrappe(conflictId);
  });

  ipcMain.handle("conflicts:keepBoth", async (event, conflictId) => {
    return await resolveKeepBoth(conflictId);
  });
  ipcMain.handle("files:listTrash", () => {
    const db = getDatabase();
    const user = db.prepare("SELECT * FROM users LIMIT 1").get();
    if (!user) return [];
    return db
      .prepare("SELECT * FROM trash WHERE user_id = ? ORDER BY deleted_at DESC")
      .all(user.id);
  });

  ipcMain.handle("files:restore", async (event, entityName) => {
    const db = getDatabase();
    const user = db.prepare("SELECT * FROM users LIMIT 1").get();
    const { trashOrRestore } = require("../src/sync/api");
    await trashOrRestore(user.frappe_url, user.session_cookie, [entityName]);
    db.prepare("DELETE FROM trash WHERE entity_name = ? AND user_id = ?").run(
      entityName,
      user.id,
    );
    db.prepare(
      "UPDATE sync_state SET status = ? WHERE entity_name = ? AND user_id = ?",
    ).run("synced", entityName, user.id);
    return { success: true };
  });

  ipcMain.handle("files:permanentDelete", async (event, entityName) => {
    const db = getDatabase();
    const user = db.prepare("SELECT * FROM users LIMIT 1").get();
    const { permanentDelete } = require("../src/sync/api");
    await permanentDelete(user.frappe_url, user.session_cookie, [entityName]);
    db.prepare("DELETE FROM trash WHERE entity_name = ? AND user_id = ?").run(
      entityName,
      user.id,
    );
    db.prepare(
      "DELETE FROM sync_state WHERE entity_name = ? AND user_id = ?",
    ).run(entityName, user.id);
    return { success: true };
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
    return { success: true };
  });
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
