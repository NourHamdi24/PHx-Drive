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

  // Delete (permanently — both local and remote)
  deleteFile: (entityName) => ipcRenderer.invoke("files:delete", entityName),

  // Manually download a remote-only or updated file
  downloadFile: (entityName) => ipcRenderer.invoke("files:download", entityName),

  // Open a file locally with its default OS application (downloads it first if needed)
  openFile: (entityName) => ipcRenderer.invoke("files:open", entityName),

  // Sync
  runSync: () => ipcRenderer.invoke("sync:run"),
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
  getUserProfile: () => ipcRenderer.invoke("settings:getUserProfile"),
  getUserRank: () => ipcRenderer.invoke("settings:getUserRank"),
  getEnergyPoints: () => ipcRenderer.invoke("settings:getEnergyPoints"),

  // System
  openExternal: (url) => ipcRenderer.invoke("system:openExternal", url),
  openGuide: () => ipcRenderer.invoke("system:openGuide"),
});
