# Ultimate Installer

An Electron desktop app for Windows that lets a user tick the applications they
want and install them silently, in the background — in the style of DriverPack
Solution. It can run **fully offline** using a bundled installer repository, and
falls back to vendor downloads or `winget` when a file is not bundled.

## Features

- 44-app catalogue across Browsers, Media, Utilities, Security, Development,
  Communication, Productivity and Runtimes.
- **Offline-first**: local setup files take priority over the internet.
- Category sidebar, live search and detected-installed badges.
- Per-app source badge: `Offline`, `Download` or `winget`.
- Multi-select with a sequential background install queue.
- Per-item progress, cancellation, and a completion summary.
- Detection of already-installed software via the Windows uninstall registry.

---

## Why the browser shows no apps

The catalogue is served by the Electron **main process** and handed to the UI
through a secure bridge (`window.installer`, defined in `electron/preload.cjs`).
A plain browser has no such bridge, so the list is empty and the install button
does nothing. **The UI only works inside Electron.**

## Test running it (the real desktop app)

The most useful command during development is:

```powershell
npm run dev
```

That starts Vite and launches Electron pointed at it, with hot reload. An
Electron window opens — that is the app. This is exactly how the UI was
verified.

Other ways to run it:

| Command         | What it does                                                        |
| --------------- | ------------------------------------------------------------------- |
| `npm run dev`   | Vite + Electron together, hot reload. **Use this normally.**         |
| `npm start`     | Builds the UI and launches the built Electron app (production path). |
| `npm run web`   | Vite only, in a browser — layout preview, **no apps will load**.     |
| `npm run pack`  | Unpacked build in `release/win-unpacked`.                            |
| `npm run dist`  | NSIS installer in `release/`.                                        |

If `npm run dev` opens the window but you want to see internal errors, the
DevTools window detaches automatically in development mode.

---

## Going offline (like DriverPack Solution)

DriverPack ships its payload on disk. Here you do the same by dropping setup
files into the **`installers/`** folder at the project root.

The engine resolves every app in this order:

1. **Offline** — a matching file in `installers/`
2. **Download** — the app's `url` (vendor download)
3. **winget** — the app's `wingetId`

If a local file exists, it always wins, so one build works both online and
offline. The header shows an **Offline repo: N files** badge, and each app card
shows which source it will use.

### Do I need to add installers?

Only if you want offline installs. The app works online without any. For a true
DriverPack-style offline disc, bundle the apps you care about.

### How to add an installer

1. Copy the setup file into `installers/` (sub-folders are fine):

   ```
   installers/
     vlc.exe
     firefox-setup.exe
     runtimes/vc_redist.x64.exe
   ```

   Supported types: `.exe`, `.msi`, `.bat`, `.cmd`, `.ps1`.

2. Matching is automatic by name:
   - exact match on the app `id` → `vlc.exe` for the `vlc` app
   - exact match on a `localFile` value
   - fuzzy match on `id` or `name` → `vlc-3.0.20-win64.exe` still matches `vlc`

3. To remove all ambiguity, set `localFile` on the catalogue entry in
   `electron/data/software.json`:

   ```json
   {
     "id": "mozilla-firefox",
     "name": "Mozilla Firefox",
     "localFile": "firefox-setup.exe",
     "silentArgs": ["/S"],
     "detect": ["Mozilla Firefox"]
   }
   ```

4. Make sure the entry has the correct `silentArgs`, otherwise the setup wizard
   will appear on screen. See `installers/README.md` for a cheat sheet of silent
   switches (NSIS, Inno, MSI, InstallShield).

`.msi` files are wrapped with `msiexec /i` automatically. `.bat`, `.cmd` and
`.ps1` files are executed by their shell.

Run `npm run dev`, press **Rescan**, and the card should switch to an
`OFFLINE` badge once the file is picked up.

### How the offline files get into the packaged app

`electron-builder` copies `installers/` into `resources/installers` via the
`extraResources` setting in `package.json`. At runtime the app looks there when
packaged, and at the project-root `installers/` folder in development.

> Setup binaries are ignored by git (see `.gitignore`), so a fresh clone needs
> the payload added again before building an offline installer.

---

## Adding an application to the catalogue

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
  "localFile": "setup.exe",
  "silentArgs": ["/S"],
  "wingetId": "Vendor.App",
  "detect": ["App Name"]
}
```

- `url` + `silentArgs` → direct download strategy
- `localFile` → offline strategy
- `wingetId` → winget fallback
- `detect` → substrings matched against installed program names

You may provide any combination; the engine picks the best available source.

---

## Build

```powershell
npm run build        # renderer -> dist/
npm run pack         # unpacked app in release/win-unpacked
npm run dist         # NSIS installer in release/
```

## Project layout

```
electron/
  main.cjs           Electron main process, window + IPC
  preload.cjs        contextBridge API exposed as window.installer
  installer.cjs      Offline / download / winget engine + detection
  data/software.json App catalogue
installers/          Offline installer repository (README + your setup files)
src/
  App.jsx            Root UI + state machine
  components/        Sidebar, TopBar, AppCard, InstallPanel
  lib/bridge.js      Renderer-side API wrapper
index.html           Vite entry
```

## Requirements

- Windows 10/11 (x64)
- Node.js 20+
- Administrator rights for machine-wide installers (UAC will prompt)
- Internet only if you rely on `download` or `winget` sources