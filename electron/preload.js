const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  // Auth
  login: (email, password) => ipcRenderer.invoke("auth:login", email, password),
  autoLogin: () => ipcRenderer.invoke("auth:autoLogin"),
  logout: () => ipcRenderer.invoke("auth:logout"),
});
