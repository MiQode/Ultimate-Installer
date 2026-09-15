"use strict";

const fs = require("node:fs");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const https = require("node:https");
const http = require("node:http");
const { spawn, execFile } = require("node:child_process");

const DOWNLOAD_DIR = path.join(os.tmpdir(), "ultimate-installer");

/**
 * Thin wrapper around the actual install work so the main process can drive it
 * and forward progress to the renderer.
 */
class Installer {
  constructor() {
    this.activeChildren = new Set();
    this.activeDownloads = new Set();
    this.cancelled = false;
    this.installedCache = null;
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

    if (app.url) {
      try {
        return await this.installFromUrl(app, report);
      } catch (error) {
        if (this.cancelled) {
          return { id: app.id, name: app.name, status: "cancelled" };
        }
        report({ phase: "fallback", message: `Direct download failed: ${error.message}` });
      }
    }

    return this.installWithWinget(app, report);
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
    const code = await this.runInstaller(destination, app.silentArgs || []);

    await fsp.rm(destination, { force: true }).catch(() => {});

    if (this.cancelled) return { id: app.id, name: app.name, status: "cancelled" };
    if (code === 0 || code === 3010) {
      return {
        id: app.id,
        name: app.name,
        status: "installed",
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

    if (this.cancelled) return { id: app.id, name: app.name, status: "cancelled" };
    if (code === 0) return { id: app.id, name: app.name, status: "installed" };
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
}

module.exports = { Installer, DOWNLOAD_DIR };