"use strict";

const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { Installer } = require("./installer.cjs");
const { isElevated, relaunchElevated } = require("./elevation.cjs");

const isDev = process.env.NODE_ENV === "development";
const SKIP_ELEVATION = process.env.ULTIMATE_NO_ELEVATE === "1";

// Only one instance may run, otherwise an elevated relaunch would leave a
// duplicate window behind.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

/**
 * The offline repository. In a packaged build electron-builder copies
 * `installers/` to `resources/installers`; in development we read it from the
 * project root.
 */
const OFFLINE_DIR = app.isPackaged
  ? path.join(process.resourcesPath, "installers")
  : path.join(__dirname, "..", "installers");

const installer = new Installer(OFFLINE_DIR);

let mainWindow = null;

function loadCatalogue() {
  const file = path.join(__dirname, "data", "software.json");
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    console.error("Failed to load software catalogue:", error.message);
    return [];
  }
}

function resolveIcon() {
  const candidates = [
    path.join(__dirname, "..", "public", "icons", "app-icon.ico"),
    path.join(process.resourcesPath ?? "", "app-icon.ico"),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: "#0f172a",
    title: "Ultimate Installer",
    icon: resolveIcon(),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (isDev) {
    mainWindow.loadURL("http://127.0.0.1:5173");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function registerIpc() {
  ipcMain.handle("software:list", async () => {
    const catalogue = loadCatalogue();
    const installed = await installer.getInstalledPrograms(true);
    return catalogue.map((item) => ({
      ...item,
      installed: installer.isInstalled(item, installed),
      source: installer.resolveSource(item),
    }));
  });

  ipcMain.handle("software:offline-status", () => {
    const files = installer.getLocalFiles(true);
    return {
      directory: OFFLINE_DIR,
      exists: fs.existsSync(OFFLINE_DIR),
      count: files.size,
      files: Array.from(files.keys()),
    };
  });

  ipcMain.handle("software:install", async (event, apps) => {
    installer.reset();
    const results = [];
    const total = apps.length;

    for (let index = 0; index < total; index += 1) {
      const item = apps[index];
      const send = (update) =>
        event.sender.send("software:progress", {
          ...update,
          index,
          total,
          id: item.id,
          name: item.name,
        });

      try {
        send({
          phase: "queued",
          percent: 0,
          message: `Preparing ${item.name}...`,
        });
        const result = await installer.installApp(item, send);
        results.push(result);
      } catch (error) {
        results.push({
          id: item.id,
          name: item.name,
          status: "failed",
          error: error.message,
        });
      }

      event.sender.send("software:item-done", results[results.length - 1]);
    }

    installer.reset();
    event.sender.send("software:complete", results);
    return results;
  });

  ipcMain.handle("software:cancel", () => {
    installer.cancel();
    return true;
  });

  ipcMain.handle("software:winget-available", () => installer.hasWinget());

  ipcMain.handle("app:elevated", () => isElevated());
}

app.on("second-instance", () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
});

app.whenReady().then(async () => {
  // One UAC prompt for the whole session: elevate now, then every installer we
  // launch inherits the admin token and runs silently.
  if (!SKIP_ELEVATION && !(await isElevated())) {
    const started = await relaunchElevated();
    if (started) {
      app.quit();
      return;
    }
    // User declined - carry on unelevated; per-installer UAC prompts may appear.
  }

  registerIpc();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
