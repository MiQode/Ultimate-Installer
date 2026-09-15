"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("installer", {
  getSoftwareList: () => ipcRenderer.invoke("software:list"),
  getOfflineStatus: () => ipcRenderer.invoke("software:offline-status"),
  install: (apps) => ipcRenderer.invoke("software:install", apps),
  cancel: () => ipcRenderer.invoke("software:cancel"),
  hasWinget: () => ipcRenderer.invoke("software:winget-available"),
  isElevated: () => ipcRenderer.invoke("app:elevated"),

  onProgress: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on("software:progress", handler);
    return () => ipcRenderer.removeListener("software:progress", handler);
  },

  onItemDone: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on("software:item-done", handler);
    return () => ipcRenderer.removeListener("software:item-done", handler);
  },

  onComplete: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on("software:complete", handler);
    return () => ipcRenderer.removeListener("software:complete", handler);
  },
});