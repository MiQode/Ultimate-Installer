# Ultimate Installer

An Electron desktop app for Windows that lets a user tick the applications they
want and install them silently, in the background — in the style of DriverPack
Solution.

## Features

- 44-app catalogue across Browsers, Media, Utilities, Security, Development,
  Communication, Productivity and Runtimes.
- Category sidebar, live search and detected-installed badges.
- Multi-select with a sequential background install queue.
- Per-item progress, cancellation, and a completion summary.
- Two install strategies per app: direct vendor download with silent flags, or
  **winget** for the rest.
- Detection of already-installed software via the Windows uninstall registry,
  so it can be skipped instead of reinstalled.

## Getting started

```powershell
npm install
npm run dev          # Vite + Electron with hot reload
```

## Build

```powershell
npm run build        # renderer -> dist/
npm run dist         # renderer + electron-builder NSIS installer -> release/
npm run pack         # unpacked build for testing
```

## Project layout

```
electron/
  main.cjs           Electron main process, window + IPC
  preload.cjs        contextBridge API exposed as window.installer
  installer.cjs      Download / silent-run / winget / detection engine
  data/software.json App catalogue
src/
  App.jsx            Root UI + state machine
  components/        Sidebar, TopBar, AppCard, InstallPanel
  lib/bridge.js      Renderer-side API wrapper
index.html           Vite entry
```

## Adding an application

Append an entry to `electron/data/software.json`:

```json
{
  "id": "unique-id",
  "name": "App Name",
  "publisher": "Vendor",
  "category": "Utilities",
  "description": "Short description.",
  "icon": "",
  "size": "~10 MB",
  "url": "https://vendor.example/setup.exe",
  "silentArgs": ["/S"],
  "wingetId": "Vendor.App",
  "detect": ["App Name"]
}
```

- Provide `url` + `silentArgs` for a direct download, `wingetId` for the winget
  fallback, or both.
- `detect` lists substrings matched against installed program names.

## Requirements

- Windows 10/11 (x64)
- Node.js 20+
- winget available on the target machine for winget-based entries
- Administrator rights for machine-wide installers (UAC will prompt)