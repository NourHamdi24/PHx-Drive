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
  listFilesWithStatus: () => ipcRenderer.invoke("files:listWithStatus"),
  getShareLink: (entityName) =>
    ipcRenderer.invoke("files:shareLink", entityName),
  trashCount: () => ipcRenderer.invoke("trash:count"),

  // Delete (permanent — local and remote)
  trashFile: (entityName) => ipcRenderer.invoke("files:trash", entityName),

  // Sync
  runSync: () => ipcRenderer.invoke("sync:run"),
  resolveRemoteDeletion: (entityName, decision) =>
    ipcRenderer.invoke("sync:resolveRemoteDeletion", entityName, decision),
  startWatcher: () => ipcRenderer.invoke("sync:startWatcher"),
  stopWatcher: () => ipcRenderer.invoke("sync:stopWatcher"),
  startPolling: () => ipcRenderer.invoke("sync:startPolling"),
  stopPolling: () => ipcRenderer.invoke("sync:stopPolling"),

  // Settings
  saveSettings: (settings) => ipcRenderer.invoke("settings:save", settings),

  // Events from Node → React
  onSyncLog: (callback) => {
    const handler = (event, message) => callback(message);
    ipcRenderer.on("sync:log", handler);
    return () => ipcRenderer.removeListener("sync:log", handler);
  },
  onSyncRefresh: (callback) => {
    const handler = () => callback();
    ipcRenderer.on("sync:refresh", handler);
    return () => ipcRenderer.removeListener("sync:refresh", handler);
  },
  getUserSettings: () => ipcRenderer.invoke("settings:get"),
  setAutoStart: (enabled) =>
    ipcRenderer.invoke("settings:setAutoStart", enabled),
  getAutoStart: () => ipcRenderer.invoke("settings:getAutoStart"),
});
