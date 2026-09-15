/**
 * Professional Release Publisher for Retail Sathi
 * 
 * Features:
 * - Reads release title and markdown changelog from RELEASE_NOTES.md (or prompts interactively)
 * - Automatically populates GitHub Release with rich markdown (Features, Bug Fixes, Improvements)
 * - Updates latest.json with release notes so cashiers see what's new in the in-app update popup
 * - Uploads all compiled binaries and signatures directly to your public GitHub releases repository
 * 
 * Usage:
 *   npm run release:publish
 */

import fs from "fs";
import path from "path";
import readline from "readline";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

function loadEnv() {
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
}

loadEnv();

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_RELEASE_REPO = process.env.GITHUB_RELEASE_REPO || process.env.VITE_GITHUB_RELEASE_REPO;

function promptQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans.trim());
    })
  );
}

function parseCliArgs() {
  const args = process.argv.slice(2);
  const result = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--title" && args[i + 1]) {
      result.title = args[i + 1];
      i++;
    } else if (args[i] === "--notes" && args[i + 1]) {
      result.notes = args[i + 1];
      i++;
    }
  }
  return result;
}

async function getReleaseDetails(version) {
  const cli = parseCliArgs();
  const notesFile = path.join(rootDir, "RELEASE_NOTES.md");

  let releaseTitle = cli.title || "";
  let releaseBody = cli.notes || "";

  if (fs.existsSync(notesFile)) {
    const fileContent = fs.readFileSync(notesFile, "utf-8").trim();
    if (fileContent.length > 0) {
      console.log("📄 Found RELEASE_NOTES.md - using its content for this release.");
      const lines = fileContent.split("\n");
      const firstLine = lines[0].trim();
      if (firstLine.startsWith("# ")) {
        releaseTitle = firstLine.replace(/^#\s*/, "").trim();
        releaseBody = lines.slice(1).join("\n").trim();
      } else {
        releaseTitle = `Retail Sathi v${version}`;
        releaseBody = fileContent;
      }
      return { title: releaseTitle, body: releaseBody };
    }
  }

  if (!releaseTitle) {
    const inputTitle = await promptQuestion(
      `Enter Release Title [Retail Sathi v${version}]: `
    );
    releaseTitle = inputTitle || `Retail Sathi v${version}`;
  }

  if (!releaseBody) {
    console.log("\nEnter Release Highlights / Changelog (e.g. key features, fixes):");
    const inputHighlights = await promptQuestion("> ");
    releaseBody = inputHighlights
      ? `### Highlights\n- ${inputHighlights}\n\n### System Information\n- Automatic cloud sync enabled\n- Built for high-speed POS operations`
      : `### Retail Sathi v${version}\n- Performance updates\n- Bug fixes and optimizations`;
  }

  return { title: releaseTitle, body: releaseBody };
}

async function main() {
  console.log("=========================================");
  console.log("  Retail Sathi - Professional Publisher  ");
  console.log("=========================================\n");

  if (!GITHUB_TOKEN) {
    console.error("❌ ERROR: GITHUB_TOKEN is missing in .env!");
    process.exit(1);
  }

  if (!GITHUB_RELEASE_REPO || !GITHUB_RELEASE_REPO.includes("/")) {
    console.error("❌ ERROR: GITHUB_RELEASE_REPO is missing in .env!");
    process.exit(1);
  }

  const [owner, repo] = GITHUB_RELEASE_REPO.split("/");

  // Read app version
  const tauriConfPath = path.join(rootDir, "src-tauri", "tauri.conf.json");
  const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, "utf-8"));
  const version = tauriConf.version;
  const tagName = `v${version}`;

  console.log(`📦 Target Repository: https://github.com/${owner}/${repo}`);
  console.log(`🏷️  Release Tag:       ${tagName}`);
  console.log(`🚀 Version:           ${version}\n`);

  // Get professional release notes
  const { title: releaseTitle, body: releaseBody } = await getReleaseDetails(version);

  // Search bundle directories for release artifacts (both native and cross-compiled)
  const candidateDirs = [
    path.join(rootDir, "src-tauri", "target", "x86_64-pc-windows-gnu", "release", "bundle"),
    path.join(rootDir, "src-tauri", "target", "release", "bundle"),
  ];

  const filesToUpload = [];

  function collectFiles(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        collectFiles(fullPath);
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        const isValidExt =
          ext === ".exe" ||
          ext === ".msi" ||
          ext === ".zip" ||
          ext === ".sig" ||
          ext === ".deb" ||
          ext === ".appimage" ||
          ext === ".rpm";

        // ONLY include artifacts for the current version (ignore older builds)
        const isCurrentVersion = entry.name.includes(version);

        if (isValidExt && isCurrentVersion) {
          if (!filesToUpload.some((f) => f.name === entry.name)) {
            filesToUpload.push({ name: entry.name, path: fullPath });
          }
        }
      }
    }
  }

  for (const dir of candidateDirs) {
    collectFiles(dir);
  }

  // Always generate a fresh latest.json for the current version
  const platforms = {};

  const winExe = filesToUpload.find((f) => f.name.endsWith(".exe") && f.name.includes(version));
  const winSig = filesToUpload.find((f) => f.name.endsWith(".exe.sig") && f.name.includes(version));
  if (winExe && winSig) {
    platforms["windows-x86_64"] = {
      signature: fs.readFileSync(winSig.path, "utf-8").trim(),
      url: `https://github.com/${owner}/${repo}/releases/download/${tagName}/${encodeURIComponent(winExe.name)}`,
    };
  }

  const linuxAppImage = filesToUpload.find((f) => f.name.endsWith(".AppImage") && f.name.includes(version));
  const linuxSig = filesToUpload.find((f) => f.name.endsWith(".AppImage.sig") && f.name.includes(version));
  if (linuxAppImage && linuxSig) {
    platforms["linux-x86_64"] = {
      signature: fs.readFileSync(linuxSig.path, "utf-8").trim(),
      url: `https://github.com/${owner}/${repo}/releases/download/${tagName}/${encodeURIComponent(linuxAppImage.name)}`,
    };
  }

  const generatedManifest = {
    version: version,
    notes: releaseBody,
    pub_date: new Date().toISOString(),
    platforms: platforms,
  };

  const manifestPath = path.join(rootDir, "src-tauri", "target", "latest.json");
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, JSON.stringify(generatedManifest, null, 2));

  // Add the fresh latest.json to upload list
  filesToUpload.push({ name: "latest.json", path: manifestPath });
  console.log("✨ Generated fresh latest.json update manifest for v" + version);

  console.log(`\nFound ${filesToUpload.length} release artifact(s) ready to publish:`);
  for (const f of filesToUpload) {
    const sizeMb = (fs.statSync(f.path).size / (1024 * 1024)).toFixed(2);
    console.log(`  - ${f.name} (${sizeMb} MB)`);
  }
  console.log("");

  const headers = {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "RetailSathi-ReleaseTool",
  };

  // 1. Create or Update GitHub Release
  console.log(`🔍 Checking release ${tagName} on GitHub...`);
  let release = null;
  const getRelRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/releases/tags/${tagName}`,
    { headers }
  );

  if (getRelRes.ok) {
    const existing = await getRelRes.json();
    console.log(`Updating existing release ${tagName}...`);
    const updateRelRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/releases/${existing.id}`,
      {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: releaseTitle,
          body: releaseBody,
          draft: false,
          prerelease: false,
        }),
      }
    );
    release = updateRelRes.ok ? await updateRelRes.json() : existing;
    console.log(`✅ Release updated: ${release.html_url}`);
  } else {
    console.log(`Creating new release for ${tagName}...`);
    const createRelRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/releases`,
      {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          tag_name: tagName,
          target_commitish: "main",
          name: releaseTitle,
          body: releaseBody,
          draft: false,
          prerelease: false,
        }),
      }
    );

    if (!createRelRes.ok) {
      const errBody = await createRelRes.text();
      console.error(`❌ Failed to create release (${createRelRes.status}):`, errBody);
      process.exit(1);
    }

    release = await createRelRes.json();
    console.log(`✅ Created release: ${release.html_url}`);
  }

  // 2. Upload assets
  const uploadUrlTemplate = release.upload_url.split("{")[0];

  for (const file of filesToUpload) {
    console.log(`⬆️  Uploading ${file.name}...`);
    const fileBuffer = fs.readFileSync(file.path);

    // Delete existing asset if it exists to allow re-upload
    const existingAsset = (release.assets || []).find((a) => a.name === file.name);
    if (existingAsset) {
      console.log(`   Replacing older asset #${existingAsset.id} (${file.name})...`);
      await fetch(
        `https://api.github.com/repos/${owner}/${repo}/releases/assets/${existingAsset.id}`,
        { method: "DELETE", headers }
      );
    }

    const uploadRes = await fetch(`${uploadUrlTemplate}?name=${encodeURIComponent(file.name)}`, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/octet-stream",
        "Content-Length": String(fileBuffer.length),
      },
      body: fileBuffer,
    });

    if (uploadRes.ok) {
      console.log(`   ✅ Uploaded ${file.name}`);
    } else {
      const uploadErr = await uploadRes.text();
      console.warn(`   ⚠️ Upload response for ${file.name}:`, uploadErr);
    }
  }

  console.log("\n=========================================");
  console.log("🎉 PROFESSIONAL RELEASE PUBLISHED!");
  console.log(`📌 Title: ${releaseTitle}`);
  console.log(`🔗 Link:  ${release.html_url}`);
  console.log("=========================================\n");
}

main().catch((err) => {
  console.error("Unhandled error in release publisher:", err);
  process.exit(1);
});
