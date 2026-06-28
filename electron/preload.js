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

  // Trash
  listTrash: () => ipcRenderer.invoke("files:listTrash"),
  restoreFile: (entityName) => ipcRenderer.invoke("files:restore", entityName),
  permanentDelete: (entityName) =>
    ipcRenderer.invoke("files:permanentDelete", entityName),

  // Sync
  runSync: () => ipcRenderer.invoke("sync:run"),
  startWatcher: () => ipcRenderer.invoke("sync:startWatcher"),
  stopWatcher: () => ipcRenderer.invoke("sync:stopWatcher"),
  startPolling: () => ipcRenderer.invoke("sync:startPolling"),
  stopPolling: () => ipcRenderer.invoke("sync:stopPolling"),

  // Conflicts
  listConflicts: () => ipcRenderer.invoke("conflicts:list"),
  keepLocal: (id) => ipcRenderer.invoke("conflicts:keepLocal", id),
  keepFrappe: (id) => ipcRenderer.invoke("conflicts:keepFrappe", id),
  keepBoth: (id) => ipcRenderer.invoke("conflicts:keepBoth", id),

  // Settings
  saveSettings: (settings) => ipcRenderer.invoke("settings:save", settings),

  // Events from Node → React
  onSyncLog: (callback) =>
    ipcRenderer.on("sync:log", (event, message) => callback(message)),
  onSyncRefresh: (callback) => ipcRenderer.on("sync:refresh", () => callback()),
});
