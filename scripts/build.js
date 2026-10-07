import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

// Load .env
const envPath = path.join(rootDir, ".env");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...values] = trimmed.split("=");
      if (key && values.length > 0) {
        process.env[key.trim()] = values.join("=").trim().replace(/^["']|["']$/g, "");
      }
    }
  }
}

// Fallback to key file if TAURI_SIGNING_PRIVATE_KEY is not in .env
if (!process.env.TAURI_SIGNING_PRIVATE_KEY) {
  const keyFile = path.join(process.env.HOME || "", ".tauri", "retailsathi.key");
  if (fs.existsSync(keyFile)) {
    process.env.TAURI_SIGNING_PRIVATE_KEY = fs.readFileSync(keyFile, "utf-8").trim();
  }
}

// Automatically clean old bundle outputs before building to avoid mixing old versions
const bundleDirsToClean = [
  path.join(rootDir, "src-tauri", "target", "release", "bundle"),
  path.join(rootDir, "src-tauri", "target", "x86_64-pc-windows-gnu", "release", "bundle"),
];

for (const dir of bundleDirsToClean) {
  if (fs.existsSync(dir)) {
    console.log(`🧹 Cleaning previous bundle output: ${path.relative(rootDir, dir)}`);
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch (e) {
      console.warn(`Could not clean ${dir}:`, e.message);
    }
  }
}

const extraArgs = process.argv.slice(2);
console.log("🔨 Starting signed Tauri build for Retail Sathi...", extraArgs.join(" "));
const child = spawn("npx", ["tauri", "build", ...extraArgs], {
  cwd: rootDir,
  env: process.env,
  stdio: "inherit",
  shell: true,
});

child.on("exit", (code) => {
  process.exit(code || 0);
});
