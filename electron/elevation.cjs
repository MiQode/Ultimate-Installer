"use strict";

const { execFile, spawn } = require("node:child_process");

/**
 * User Account Control handling.
 *
 * Windows will not let a process silently approve a UAC prompt - and it must
 * not, or every piece of malware would do exactly that. The correct pattern
 * (used by DriverPack and friends) is to elevate the whole application ONCE,
 * then launch child installers from the already-elevated process. Those
 * children inherit the admin token, so the user sees exactly one prompt for
 * the entire session instead of one per installer.
 */

/**
 * True when the current process already holds an elevated (admin) token.
 * `net session` only succeeds for administrators, which makes it a reliable
 * and cheap probe.
 */
function isElevated() {
  if (process.platform !== "win32") return true;

  return new Promise((resolve) => {
    execFile(
      "net",
      ["session"],
      { windowsHide: true, timeout: 5000 },
      (error) => resolve(!error),
    );
  });
}

/**
 * Relaunches the current executable through PowerShell's `Start-Process -Verb
 * RunAs`, which raises the one-time UAC dialog. Resolves to `true` when the
 * elevated instance was launched so the caller can quit this one.
 */
function relaunchElevated({ args = [], onError = () => {} } = {}) {
  return new Promise((resolve) => {
    if (process.platform !== "win32") return resolve(false);

    const executable = process.execPath;
    const quotedArgs = args
      .map((arg) => `'${String(arg).replace(/'/g, "''")}'`)
      .join(" ");

    const command = quotedArgs
      ? `Start-Process -FilePath '${executable.replace(/'/g, "''")}' -ArgumentList @(${quotedArgs}) -Verb RunAs`
      : `Start-Process -FilePath '${executable.replace(/'/g, "''")}' -Verb RunAs`;

    const child = spawn(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", command],
      { windowsHide: true, stdio: "ignore" },
    );

    child.on("error", (error) => {
      onError(error);
      resolve(false);
    });

    child.on("close", (code) => {
      if (code === 0) return resolve(true);
      onError(new Error(`Elevation prompt was declined (code ${code})`));
      resolve(false);
    });
  });
}

module.exports = { isElevated, relaunchElevated };