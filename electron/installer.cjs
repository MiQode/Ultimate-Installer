"use strict";

const fs = require("node:fs");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const https = require("node:https");
const http = require("node:http");
const { spawn, execFile } = require("node:child_process");

const DOWNLOAD_DIR = path.join(os.tmpdir(), "ultimate-installer");
const INSTALLER_EXTENSIONS = [".exe", ".msi", ".bat", ".cmd", ".ps1"];

/**
 * Thin wrapper around the actual install work so the main process can drive it
 * and forward progress to the renderer.
 *
 * Install preference per app:
 *   1. local file in the offline `installers/` repository
 *   2. direct vendor download (`url`)
 *   3. winget (`wingetId`)
 */
class Installer {
  /**
   * @param {string} localRepo path to the offline installers directory
   */
  constructor(localRepo = null) {
    this.activeChildren = new Set();
    this.activeDownloads = new Set();
    this.cancelled = false;
    this.installedCache = null;
    this.localRepo = localRepo;
    this.localFiles = null;
  }

  // ---------------------------------------------------------------------------
  // Offline repository
  // ---------------------------------------------------------------------------

  setLocalRepo(dir) {
    this.localRepo = dir;
    this.localFiles = null;
  }

  /**
   * Indexes the offline repository once, mapping lower-cased file name ->
   * absolute path. Missing directory simply yields an empty index.
   */
  getLocalFiles(force = false) {
    if (this.localFiles && !force) return this.localFiles;

    const index = new Map();
    if (this.localRepo && fs.existsSync(this.localRepo)) {
      const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walk(full);
            continue;
          }
          if (INSTALLER_EXTENSIONS.includes(path.extname(entry.name).toLowerCase())) {
            index.set(entry.name.toLowerCase(), full);
          }
        }
      };
      walk(this.localRepo);
    }

    this.localFiles = index;
    return index;
  }

  /**
   * Resolves the offline file for an app. `localFile` may be an exact name or a
   * partial name; otherwise we match on the app id as a fallback.
   */
  resolveLocalFile(app) {
    const files = this.getLocalFiles();
    if (files.size === 0) return null;

    const candidates = [app.localFile, app.id, app.name]
      .filter(Boolean)
      .map((value) => String(value).toLowerCase());

    for (const candidate of candidates) {
      if (files.has(candidate)) return files.get(candidate);
    }

    for (const candidate of candidates) {
      const slug = candidate.replace(/[^a-z0-9]/g, "");
      for (const [name, full] of files) {
        if (name.replace(/[^a-z0-9]/g, "").includes(slug)) return full;
      }
    }

    return null;
  }

  // ---------------------------------------------------------------------------
  // Detection
  // ---------------------------------------------------------------------------

  /**
   * Reads every uninstall-registry entry once and returns the list of
   * DisplayName values. Used to tell whether a catalogue app is already present.
   */
  async getInstalledPrograms(force = false) {
    if (this.installedCache && !force) return this.installedCache;

    const script = [
      "$ErrorActionPreference='SilentlyContinue';",
      "$keys=@('HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',",
      "'HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',",
      "'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*');",
      "Get-ItemProperty $keys | Where-Object { $_.DisplayName } |",
      "Select-Object -ExpandProperty DisplayName -Unique | ConvertTo-Json -Compress",
    ].join(" ");

    const names = await new Promise((resolve) => {
      execFile(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-Command", script],
        { windowsHide: true, maxBuffer: 8 * 1024 * 1024 },
        (error, stdout) => {
          if (error || !stdout.trim()) return resolve([]);
          try {
            const parsed = JSON.parse(stdout.trim());
            resolve(Array.isArray(parsed) ? parsed : [parsed]);
          } catch {
            resolve([]);
          }
        },
      );
    });

    this.installedCache = names;
    return names;
  }

  isInstalled(app, installedPrograms) {
    if (!app.detect || app.detect.length === 0) return false;
    const haystack = installedPrograms.map((n) => String(n).toLowerCase());
    return app.detect.some((needle) =>
      haystack.some((name) => name.includes(String(needle).toLowerCase())),
    );
  }

  async hasWinget() {
    if (this._wingetAvailable !== undefined) return this._wingetAvailable;
    this._wingetAvailable = await new Promise((resolve) => {
      execFile("winget", ["--version"], { windowsHide: true }, (error) =>
        resolve(!error),
      );
    });
    return this._wingetAvailable;
  }

  // ---------------------------------------------------------------------------
  // Installation
  // ---------------------------------------------------------------------------

  /**
   * Installs a single catalogue app.
   * @param {object} app catalogue entry
   * @param {(update: object) => void} report progress callback
   */
  async installApp(app, report = () => {}) {
    if (this.cancelled) {
      return { id: app.id, name: app.name, status: "cancelled" };
    }

    const localFile = this.resolveLocalFile(app);
    if (localFile) {
      return this.installLocal(app, localFile, report);
    }

    if (app.url) {
      try {
        return await this.installFromUrl(app, report);
      } catch (error) {
        if (this.cancelled) {
          return { id: app.id, name: app.name, status: "cancelled" };
        }
        report({
          phase: "fallback",
          message: `Direct download failed: ${error.message}`,
        });
      }
    }

    return this.installWithWinget(app, report);
  }

  /**
   * Runs an installer that ships with the application (offline mode).
   *
   * Script types (.bat/.cmd/.ps1) are the escape hatch for installers that
   * expose preference checkboxes or bundled offers: point `localFile` at a
   * wrapper script that automates those choices, and it runs here silently.
   */
  async installLocal(app, localFile, report) {
    report({
      phase: "installing",
      percent: 100,
      message: `Installing ${app.name} from bundled installer...`,
    });

    const ext = path.extname(localFile).toLowerCase();
    const args = (app.silentArgs || []).map((arg) =>
      String(arg).replace("{file}", localFile),
    );

    let code;
    if (ext === ".msi") {
      code = await this.runMsi(localFile, args);
    } else if (ext === ".bat" || ext === ".cmd") {
      code = await this.runCommand("cmd.exe", ["/c", localFile, ...args]);
    } else if (ext === ".ps1") {
      code = await this.runCommand("powershell.exe", [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        localFile,
        ...args,
      ]);
    } else {
      code = await this.runInstaller(localFile, args);
    }

    await this.closeAutoLaunched(app);

    if (this.cancelled) return { id: app.id, name: app.name, status: "cancelled" };
    if (code === 0 || code === 3010) {
      return {
        id: app.id,
        name: app.name,
        status: "installed",
        source: "offline",
        rebootRequired: code === 3010,
      };
    }
    throw new Error(`Installer exited with code ${code}`);
  }

  /**
   * Always-quiet MSI invocation. Adds `/qn` (no UI) and suppresses reboots
   * unless the catalogue entry overrides them, so no wizard or restart dialog
   * can interrupt the run.
   */
  runMsi(msiPath, extraArgs = []) {
    const args = ["/i", msiPath];
    const lowered = extraArgs.map((a) => a.toLowerCase());

    if (!lowered.includes("/qn") && !lowered.includes("/quiet") && !lowered.includes("/passive")) {
      args.push("/qn");
    }
    if (!lowered.some((a) => a.startsWith("/norestart") || a.includes("reboot="))) {
      args.push("/norestart", "REBOOT=ReallySuppress");
    }

    args.push(...extraArgs);
    return this.runCommand("msiexec", args);
  }

  /**
   * Terminates applications that some installers auto-open once finished, so
   * the user is not interrupted. Apps opt in via `killAfter: ["chrome"]`.
   */
  async closeAutoLaunched(app) {
    if (this.cancelled) return;
    const names = (app.killAfter || []).filter(Boolean);
    if (names.length === 0) return;

    await Promise.all(
      names.map(
        (name) =>
          new Promise((resolve) => {
            execFile(
              "taskkill",
              ["/IM", name, "/F", "/T"],
              { windowsHide: true, timeout: 8000 },
              () => resolve(),
            );
          }),
      ),
    );
  }

  async installFromUrl(app, report) {
    await fsp.mkdir(DOWNLOAD_DIR, { recursive: true });
    const destination = path.join(DOWNLOAD_DIR, `${app.id}-${Date.now()}.exe`);

    report({ phase: "downloading", percent: 0, message: `Downloading ${app.name}...` });
    await this.download(app.url, destination, (percent) =>
      report({
        phase: "downloading",
        percent,
        message: `Downloading ${app.name}... ${percent}%`,
      }),
    );

    if (this.cancelled) throw new Error("Cancelled");

    report({ phase: "installing", percent: 100, message: `Installing ${app.name}...` });
    const ext = path.extname(destination).toLowerCase();
    const code =
      ext === ".msi"
        ? await this.runMsi(destination, app.silentArgs || [])
        : await this.runInstaller(destination, app.silentArgs || []);

    await this.closeAutoLaunched(app);
    await fsp.rm(destination, { force: true }).catch(() => {});

    if (this.cancelled) return { id: app.id, name: app.name, status: "cancelled" };
    if (code === 0 || code === 3010) {
      return {
        id: app.id,
        name: app.name,
        status: "installed",
        source: "download",
        rebootRequired: code === 3010,
      };
    }
    throw new Error(`Installer exited with code ${code}`);
  }

  async installWithWinget(app, report) {
    if (!app.wingetId || !(await this.hasWinget())) {
      throw new Error(
        "No direct download and winget is unavailable. Cannot install automatically.",
      );
    }

    report({
      phase: "installing",
      percent: 100,
      message: `Installing ${app.name} via winget...`,
    });

    const args = [
      "install",
      "--id",
      app.wingetId,
      "--exact",
      "--silent",
      "--accept-source-agreements",
      "--accept-package-agreements",
      "--disable-interactivity",
    ];

    const code = await this.runCommand("winget", args, (line) =>
      report({ phase: "installing", percent: 100, message: line.trim() || app.name }),
    );

    await this.closeAutoLaunched(app);

    if (this.cancelled) return { id: app.id, name: app.name, status: "cancelled" };
    if (code === 0) {
      return { id: app.id, name: app.name, status: "installed", source: "winget" };
    }
    if (code === -1978335189) {
      return { id: app.id, name: app.name, status: "already-installed" };
    }
    throw new Error(`winget exited with code ${code}`);
  }

  // ---------------------------------------------------------------------------
  // Low level helpers
  // ---------------------------------------------------------------------------

  download(url, destination, onProgress) {
    return new Promise((resolve, reject) => {
      const request = (currentUrl, redirects = 0) => {
        if (redirects > 10) return reject(new Error("Too many redirects"));

        const lib = currentUrl.startsWith("http://") ? http : https;
        const req = lib.get(
          currentUrl,
          { headers: { "User-Agent": "UltimateInstaller/1.0" } },
          (res) => {
            if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
              res.resume();
              return request(new URL(res.headers.location, currentUrl).toString(), redirects + 1);
            }
            if (res.statusCode !== 200) {
              res.resume();
              return reject(new Error(`HTTP ${res.statusCode}`));
            }

            const total = Number(res.headers["content-length"] || 0);
            let received = 0;
            const file = fs.createWriteStream(destination);

            res.on("data", (chunk) => {
              received += chunk.length;
              if (total) {
                onProgress(Math.round((received / total) * 100));
              }
            });
            res.pipe(file);

            file.on("finish", () => file.close(() => resolve(destination)));
            file.on("error", reject);
            res.on("error", reject);
          },
        );

        this.activeDownloads.add(req);
        req.on("close", () => this.activeDownloads.delete(req));
        req.on("error", (error) => {
          this.activeDownloads.delete(req);
          reject(error);
        });
      };

      request(url);
    });
  }

  runInstaller(executable, args) {
    return this.runCommand(executable, args, null, true);
  }

  runCommand(command, args, onOutput, isExecutable = false) {
    return new Promise((resolve, reject) => {
      let child;
      try {
        child = isExecutable
          ? spawn(command, args, { windowsHide: true })
          : spawn(command, args, { windowsHide: true, shell: false });
      } catch (error) {
        return reject(error);
      }

      this.activeChildren.add(child);

      const forward = (buffer) => {
        if (onOutput) onOutput(buffer.toString());
      };
      child.stdout?.on("data", forward);
      child.stderr?.on("data", forward);

      child.on("error", (error) => {
        this.activeChildren.delete(child);
        reject(error);
      });

      child.on("close", (code) => {
        this.activeChildren.delete(child);
        resolve(code === null ? -1 : code);
      });
    });
  }

  cancel() {
    this.cancelled = true;
    for (const req of this.activeDownloads) {
      req.destroy(new Error("Cancelled by user"));
    }
    this.activeDownloads.clear();
    for (const child of this.activeChildren) {
      child.kill();
    }
    this.activeChildren.clear();
  }

  reset() {
    this.cancelled = false;
    this.installedCache = null;
  }

  /**
   * Describes how an app would be installed right now, so the UI can show an
   * Offline / Download / winget badge.
   */
  resolveSource(app) {
    if (this.resolveLocalFile(app)) return "offline";
    if (app.url) return "download";
    if (app.wingetId) return "winget";
    return "unavailable";
  }
}

module.exports = { Installer, DOWNLOAD_DIR };