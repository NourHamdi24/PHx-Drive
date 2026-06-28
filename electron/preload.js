const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  // Auth
  login: (email, password) => ipcRenderer.invoke("auth:login", email, password),
  autoLogin: () => ipcRenderer.invoke("auth:autoLogin"),
  logout: () => ipcRenderer.invoke("auth:logout"),

  // Folder picker
  selectFolder: () => ipcRenderer.invoke("dialog:selectFolder"),
  saveSyncFolder: (path) => ipcRenderer.invoke("auth:saveSyncFolder", path),

  // Files
  listFiles: () => ipcRenderer.invoke("files:list"),
  getShareLink: (entityName) =>
    ipcRenderer.invoke("files:shareLink", entityName),

  // Sync
  runSync: () => ipcRenderer.invoke("sync:run"),
  onSyncLog: (callback) =>
    ipcRenderer.on("sync:log", (event, message) => callback(message)),
  onSyncRefresh: (callback) => ipcRenderer.on("sync:refresh", () => callback()),
  startWatcher: () => ipcRenderer.invoke("sync:startWatcher"),
  stopWatcher: () => ipcRenderer.invoke("sync:stopWatcher"),
});
