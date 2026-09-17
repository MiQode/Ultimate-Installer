"use strict";

const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const ROOT = path.join(__dirname, "..");

const args = process.argv.slice(2);
const isDir = args.includes("--dir");

// Windows Defender locks files inside the project tree during packaging.
// Building to a temp dir outside the project avoids the EBUSY error, then the
// result is moved to release/. If that move fails (another lock), the output
// stays in the temp dir and the path is printed for the user.

const TEMP_DIR = path.join(
  os.tmpdir(),
  "ultimate-installer-build-" + Date.now(),
);
const FINAL_DIR = path.join(ROOT, "release");

fs.mkdirSync(TEMP_DIR, { recursive: true });

const ebArgs = isDir ? ["--dir"] : ["--win"];
const cmd = `npx electron-builder ${ebArgs.join(" ")} --config.directories.output="${TEMP_DIR}"`;

try {
  console.log(`Building to: ${TEMP_DIR}`);
  execSync(cmd, { cwd: ROOT, stdio: "inherit" });
} catch {
  process.exitCode = 1;
  return;
} finally {
  // Always try to move the result, even on partial success
}

// Move output to the final location
try {
  if (fs.existsSync(FINAL_DIR)) {
    fs.rmSync(FINAL_DIR, { recursive: true, force: true });
  }
  fs.cpSync(TEMP_DIR, FINAL_DIR, { recursive: true });
  fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  console.log(`\nBuild output: ${FINAL_DIR}`);
} catch {
  console.log(`\nBuild output (could not move to release/): ${TEMP_DIR}`);
}
