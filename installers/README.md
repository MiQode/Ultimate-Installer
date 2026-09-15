# Offline installer repository

Drop the setup files you want to distribute here. This is what makes Ultimate
Installer work **without an internet connection**, the way DriverPack Solution
ships its driver and software payload on disk.

## How matching works

For every app in `electron/data/software.json` the engine looks for a file here
in this order:

1. An exact match on the app's `localFile` value (if present).
2. An exact match on the app `id` (e.g. `vlc.exe` for the `vlc` app).
3. A fuzzy match on the app `id` or `name` (e.g. `VLC Media Player` matches
   `vlc-3.0.20-win64.exe`).

Only `.exe`, `.msi`, `.bat`, `.cmd` and `.ps1` files are indexed. Sub-folders
are scanned too.

## Example layout

```
installers/
  vlc.exe                    -> app id "vlc"
  firefox-setup.exe          -> app id "mozilla-firefox" (via localFile)
  chrome.exe
  runtimes/
    vc_redist.x64.exe
    dotnet-desktop-runtime.exe
```

## Pointing an app at a specific file

Add a `localFile` field to the catalogue entry so there is no ambiguity:

```json
{
  "id": "mozilla-firefox",
  "name": "Mozilla Firefox",
  "localFile": "firefox-setup.exe",
  "silentArgs": ["/S"],
  "detect": ["Mozilla Firefox"]
}
```

If a file is found, it wins over the online `url` and over `winget` — so the
same build works online and offline.

## Silent switches

Each catalogue entry supplies its own `silentArgs`, for example:

| Installer type | Silent arguments            |
| -------------- | --------------------------- |
| NSIS (VLC)     | `/S`                        |
| Inno Setup     | `/VERYSILENT /NORESTART`    |
| MSI            | `/quiet /norestart`         |
| InstallShield  | `/s /v"/qn"`                |

`.msi` files are run through `msiexec /i <file> <args>` automatically, so you
only need the MSI-specific switches.

## Tip

You do not have to bundle every app. Bundle the ones you care about offline and
leave the rest to download or winget — the UI badges each app with the source it
will use.