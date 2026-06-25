const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const { getDatabase } = require("../src/db/database");
const {
  handleLogin,
  handleAutoLogin,
  handleLogout,
} = require("../src/auth/authHandler");

function createWindow() {
  const win = new BrowserWindow({
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
    win.loadURL("http://localhost:5173");
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(() => {
  const db = getDatabase();
  console.log("Database ready:", db.name);

  // ─── IPC Handlers ──────────────────────────────────────
  ipcMain.handle("auth:login", async (event, email, password) => {
    return await handleLogin(email, password);
  });

  ipcMain.handle("auth:autoLogin", async () => {
    return await handleAutoLogin();
  });

  ipcMain.handle("auth:logout", () => {
    return handleLogout();
  });

  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
ipcMain.handle("dialog:selectFolder", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"],
    title: "Choose your PHx Drive sync folder",
    buttonLabel: "Select Folder",
  });

  if (result.canceled) return null;
  return result.filePaths[0];
});
