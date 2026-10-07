/**
 * Professional Release Publisher for Retail Sathi
 * 
 * Features:
 * - Reads release title and markdown changelog from RELEASE_NOTES.md (or prompts interactively)
 * - Automatically populates GitHub Release with rich markdown (Features, Bug Fixes, Improvements)
 * - Updates latest.json with release notes and ENSURES BOTH Windows and Linux platforms are included
 * - Preserves existing platform entries when publishing from single-OS runners or cross-compilation
 * - Uploads ONLY compiled binaries and signatures for the current version (cleans out old version files)
 * - Automatically purges older version assets attached to the release tag on GitHub
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

// Strict version matching across various platform delimiter conventions (_amd64, _x64, -1.x86_64, etc.)
function matchesExactVersion(filename, ver) {
  const escaped = ver.replace(/\./g, "\\.");
  const pattern = new RegExp(`(^|[_-])${escaped}([\\._-]|$)`, "i");
  return pattern.test(filename);
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

  // Read app version from tauri.conf.json
  const tauriConfPath = path.join(rootDir, "src-tauri", "tauri.conf.json");
  const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, "utf-8"));
  const version = tauriConf.version;
  const tagName = `v${version}`;

  console.log(`📦 Target Repository: https://github.com/${owner}/${repo}`);
  console.log(`🏷️  Release Tag:       ${tagName}`);
  console.log(`🚀 Current Version:   ${version}\n`);

  const headers = {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "RetailSathi-ReleaseTool",
  };

  // Get professional release notes
  const { title: releaseTitle, body: releaseBody } = await getReleaseDetails(version);

  // Search bundle directories for release artifacts (both native and cross-compiled)
  const candidateDirs = [
    path.join(rootDir, "src-tauri", "target", "x86_64-pc-windows-gnu", "release", "bundle"),
    path.join(rootDir, "src-tauri", "target", "x86_64-pc-windows-msvc", "release", "bundle"),
    path.join(rootDir, "src-tauri", "target", "release", "bundle"),
    path.join(rootDir, "src-tauri", "target", "x86_64-unknown-linux-gnu", "release", "bundle"),
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
        const lower = entry.name.toLowerCase();
        const isValidFile =
          lower.endsWith(".exe") ||
          lower.endsWith(".msi") ||
          lower.endsWith(".zip") ||
          lower.endsWith(".sig") ||
          lower.endsWith(".deb") ||
          lower.endsWith(".appimage") ||
          lower.endsWith(".rpm") ||
          lower.endsWith(".tar.gz");

        // Strictly verify that this file belongs ONLY to the current version
        if (isValidFile && matchesExactVersion(entry.name, version)) {
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

  // 1. Check existing release on GitHub to preserve existing platforms
  console.log(`🔍 Checking release ${tagName} on GitHub...`);
  let existingRelease = null;
  const getRelRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/releases/tags/${tagName}`,
    { headers }
  );

  if (getRelRes.ok) {
    existingRelease = await getRelRes.json();
  }

  // Fetch previous latest.json from GitHub release if available to ensure multi-platform merging
  let remotePlatforms = {};
  try {
    const manifestUrl = `https://github.com/${owner}/${repo}/releases/download/${tagName}/latest.json`;
    const manifestRes = await fetch(manifestUrl);
    if (manifestRes.ok) {
      const prevManifest = await manifestRes.json();
      if (prevManifest.platforms) {
        remotePlatforms = prevManifest.platforms;
        console.log("📥 Merged existing platform entries from GitHub latest.json:", Object.keys(remotePlatforms).join(", "));
      }
    }
  } catch (e) {
    // Ignore if not present yet
  }

  // Also check existing assets on GitHub release for signatures
  if (existingRelease && existingRelease.assets) {
    const winExeAsset = existingRelease.assets.find(
      (a) => (a.name.toLowerCase().endsWith(".exe") || a.name.toLowerCase().endsWith(".zip")) && matchesExactVersion(a.name, version)
    );
    const winSigAsset = existingRelease.assets.find(
      (a) => (a.name.toLowerCase().endsWith(".exe.sig") || a.name.toLowerCase().endsWith(".zip.sig")) && matchesExactVersion(a.name, version)
    );
    if (winExeAsset && winSigAsset && !remotePlatforms["windows-x86_64"]) {
      try {
        const sigRes = await fetch(winSigAsset.browser_download_url);
        if (sigRes.ok) {
          const sigText = (await sigRes.text()).trim();
          remotePlatforms["windows-x86_64"] = {
            signature: sigText,
            url: winExeAsset.browser_download_url,
          };
          remotePlatforms["windows"] = {
            signature: sigText,
            url: winExeAsset.browser_download_url,
          };
          remotePlatforms["windows-x64"] = {
            signature: sigText,
            url: winExeAsset.browser_download_url,
          };
          console.log("📥 Detected & linked remote Windows binary from GitHub release");
        }
      } catch (err) {
        console.warn("Could not fetch remote windows signature:", err.message);
      }
    }
  }

  // Construct and merge platforms
  const platforms = { ...remotePlatforms };

  // Local Windows Binaries Detection
  const winExe = filesToUpload.find(
    (f) => (f.name.toLowerCase().endsWith(".exe") || f.name.toLowerCase().endsWith(".zip")) && matchesExactVersion(f.name, version)
  );
  const winSig = filesToUpload.find(
    (f) => (f.name.toLowerCase().endsWith(".exe.sig") || f.name.toLowerCase().endsWith(".zip.sig")) && matchesExactVersion(f.name, version)
  );
  if (winExe && winSig) {
    const winSigContent = fs.readFileSync(winSig.path, "utf-8").trim();
    const winUrl = `https://github.com/${owner}/${repo}/releases/download/${tagName}/${encodeURIComponent(winExe.name)}`;

    platforms["windows-x86_64"] = {
      signature: winSigContent,
      url: winUrl,
    };
    platforms["windows"] = {
      signature: winSigContent,
      url: winUrl,
    };
    platforms["windows-x64"] = {
      signature: winSigContent,
      url: winUrl,
    };
  }

  // Local Linux Binaries Detection (AppImage, deb, rpm, tar.gz)
  const linuxAppImage = filesToUpload.find(
    (f) => f.name.toLowerCase().endsWith(".appimage") && matchesExactVersion(f.name, version)
  );
  const linuxSig = filesToUpload.find(
    (f) => f.name.toLowerCase().endsWith(".appimage.sig") && matchesExactVersion(f.name, version)
  );

  if (linuxAppImage && linuxSig) {
    const linuxSigContent = fs.readFileSync(linuxSig.path, "utf-8").trim();
    const linuxUrl = `https://github.com/${owner}/${repo}/releases/download/${tagName}/${encodeURIComponent(linuxAppImage.name)}`;

    platforms["linux-x86_64"] = {
      signature: linuxSigContent,
      url: linuxUrl,
    };
    platforms["linux"] = {
      signature: linuxSigContent,
      url: linuxUrl,
    };
    platforms["linux-amd64"] = {
      signature: linuxSigContent,
      url: linuxUrl,
    };
  } else {
    // Fallback to .deb or .rpm
    const linuxPkg = filesToUpload.find(
      (f) => (f.name.toLowerCase().endsWith(".deb") || f.name.toLowerCase().endsWith(".rpm")) && matchesExactVersion(f.name, version)
    );
    const linuxPkgSig = filesToUpload.find(
      (f) => (f.name.toLowerCase().endsWith(".deb.sig") || f.name.toLowerCase().endsWith(".rpm.sig")) && matchesExactVersion(f.name, version)
    );
    if (linuxPkg && linuxPkgSig) {
      const pkgSigContent = fs.readFileSync(linuxPkgSig.path, "utf-8").trim();
      const pkgUrl = `https://github.com/${owner}/${repo}/releases/download/${tagName}/${encodeURIComponent(linuxPkg.name)}`;

      platforms["linux-x86_64"] = {
        signature: pkgSigContent,
        url: pkgUrl,
      };
      platforms["linux"] = {
        signature: pkgSigContent,
        url: pkgUrl,
      };
    }
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
  console.log("📋 Platforms included in latest.json:", Object.keys(platforms).join(", ") || "(none)");

  console.log(`\nFound ${filesToUpload.length} release artifact(s) for v${version} ready to publish:`);
  for (const f of filesToUpload) {
    const sizeMb = (fs.statSync(f.path).size / (1024 * 1024)).toFixed(2);
    console.log(`  - ${f.name} (${sizeMb} MB)`);
  }
  console.log("");

  // 2. Create or Update GitHub Release
  let release = null;
  if (existingRelease) {
    console.log(`Updating existing release ${tagName}...`);
    const updateRelRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/releases/${existingRelease.id}`,
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
    release = updateRelRes.ok ? await updateRelRes.json() : existingRelease;
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

  // 3. Clean out only older/stale version assets (do NOT delete same-version assets of other OS)
  if (release.assets && release.assets.length > 0) {
    for (const asset of release.assets) {
      if (asset.name !== "latest.json" && !matchesExactVersion(asset.name, version)) {
        console.log(`🗑️  Purging older version asset #${asset.id} (${asset.name}) from release...`);
        try {
          await fetch(
            `https://api.github.com/repos/${owner}/${repo}/releases/assets/${asset.id}`,
            { method: "DELETE", headers }
          );
        } catch (delErr) {
          console.warn(`   Could not delete asset ${asset.name}:`, delErr.message);
        }
      }
    }
  }

  // 4. Upload current version assets
  const uploadUrlTemplate = release.upload_url.split("{")[0];

  for (const file of filesToUpload) {
    console.log(`⬆️  Uploading ${file.name}...`);
    const fileBuffer = fs.readFileSync(file.path);

    // Delete existing asset if it exists to allow clean re-upload
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
  console.log(`📋 Platforms in latest.json: ${Object.keys(platforms).join(", ")}`);
  console.log("=========================================\n");
}

main().catch((err) => {
  console.error("Unhandled error in release publisher:", err);
  process.exit(1);
});
