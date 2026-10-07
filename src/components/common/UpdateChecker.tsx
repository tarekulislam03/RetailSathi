import React, { useState, useEffect } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export function triggerUpdateCheck() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("check-app-updates"));
  }
}

export const UpdateChecker: React.FC = () => {
  const [updateAvailable, setUpdateAvailable] = useState<any>(null);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadedBytes, setDownloadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function checkForUpdates(silent = true) {
    // Only check if running inside Tauri native window
    if (typeof window !== "undefined" && !("__TAURI_INTERNALS__" in window)) {
      if (!silent) {
        alert("Running in web browser mode. Auto-updater is available in the desktop application.");
      }
      return;
    }

    try {
      console.log("[Updater] Checking for updates...");
      const update = await check();
      console.log("[Updater] Check result:", update);
      if (update?.available) {
        console.log("[Updater] New version available:", update.version);
        setUpdateAvailable(update);
      } else if (!silent) {
        alert("You are on the latest version of Retail Sathi!");
      }
    } catch (err: any) {
      console.warn("[Updater] Check failed:", err);
      if (!silent) {
        alert("Could not check for updates: " + (err?.message || err));
      }
    }
  }

  useEffect(() => {
    // Listen for manual trigger from UI buttons
    const handleManualCheck = () => checkForUpdates(false);
    window.addEventListener("check-app-updates", handleManualCheck);

    // Check for updates on startup (after 3 seconds)
    const startupTimer = setTimeout(() => {
      checkForUpdates(true);
    }, 3000);

    // Periodically check every 2 hours
    const interval = setInterval(() => {
      checkForUpdates(true);
    }, 2 * 60 * 60 * 1000);

    return () => {
      window.removeEventListener("check-app-updates", handleManualCheck);
      clearTimeout(startupTimer);
      clearInterval(interval);
    };
  }, []);

  async function handleInstallUpdate() {
    if (!updateAvailable) return;
    try {
      setDownloading(true);
      setErrorMsg(null);
      let downloaded = 0;
      let contentLength = 0;

      await updateAvailable.downloadAndInstall((event: any) => {
        switch (event.event) {
          case "Started":
            contentLength = event.data.contentLength || 0;
            setTotalBytes(contentLength);
            break;
          case "Progress":
            downloaded += event.data.chunkLength;
            setDownloadedBytes(downloaded);
            if (contentLength > 0) {
              setProgress(Math.min(100, Math.round((downloaded / contentLength) * 100)));
            }
            break;
          case "Finished":
            setProgress(100);
            break;
        }
      });

      // Restart application into the new version
      await relaunch();
    } catch (err: any) {
      console.error("Update download error:", err);
      setErrorMsg(err?.message || "Failed to download update.");
      setDownloading(false);
    }
  }

  if (!updateAvailable) return null;

  const totalMb = totalBytes > 0 ? (totalBytes / (1024 * 1024)).toFixed(1) : "?";
  const downloadedMb = (downloadedBytes / (1024 * 1024)).toFixed(1);

  return (
    <div className="modal-backdrop">
      <div className="modal-content card" style={{ maxWidth: "460px" }}>
        <div className="modal-header">
          <h2>Update Available - Retail Sathi</h2>
          {!downloading && (
            <button className="close-btn" onClick={() => setUpdateAvailable(null)}>
              X
            </button>
          )}
        </div>

        <div style={{ padding: "16px", backgroundColor: "#ffffff" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                background: "linear-gradient(to bottom, #3988e3 0%, #1555a6 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontWeight: 800,
                fontSize: "1.1rem",
                boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
              }}
            >
              UP
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: "1rem", color: "#103c6b" }}>
                Retail Sathi v{updateAvailable.version}
              </div>
              <div style={{ fontSize: "0.8rem", color: "#52667d" }}>
                A new version is ready to install
              </div>
            </div>
          </div>

          {updateAvailable.body && (
            <div
              style={{
                background: "#f4f8fc",
                border: "1px solid #b8cde4",
                borderRadius: "3px",
                padding: "10px",
                fontSize: "0.84rem",
                color: "#1e395b",
                marginBottom: "14px",
                maxHeight: "120px",
                overflowY: "auto",
              }}
            >
              <strong>What's New:</strong>
              <div style={{ marginTop: "4px", whiteSpace: "pre-wrap" }}>
                {updateAvailable.body}
              </div>
            </div>
          )}

          {errorMsg && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #f87171",
                borderRadius: "3px",
                padding: "8px 10px",
                fontSize: "0.82rem",
                color: "#991b1b",
                marginBottom: "12px",
              }}
            >
              {errorMsg}
            </div>
          )}

          {downloading ? (
            <div style={{ marginTop: "12px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  color: "#103c6b",
                  marginBottom: "6px",
                }}
              >
                <span>Downloading update... {progress}%</span>
                <span>
                  {downloadedMb} MB / {totalMb} MB
                </span>
              </div>
              <div
                style={{
                  background: "#e2eaf4",
                  border: "1px solid #7092be",
                  height: "16px",
                  borderRadius: "3px",
                  overflow: "hidden",
                  boxShadow: "inset 0 1px 3px rgba(0,0,0,0.15)",
                }}
              >
                <div
                  style={{
                    background:
                      "linear-gradient(to bottom, #5cb85c 0%, #449d44 50%, #398439 100%)",
                    width: `${progress}%`,
                    height: "100%",
                    transition: "width 0.2s ease",
                  }}
                />
              </div>
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "#52667d",
                  marginTop: "6px",
                  textAlign: "center",
                }}
              >
                The app will automatically restart once downloading completes.
              </div>
            </div>
          ) : (
            <div className="form-actions" style={{ marginTop: "16px" }}>
              <button
                type="button"
                className="btn primary-btn"
                style={{ flex: 1, padding: "8px 12px", fontSize: "0.9rem", fontWeight: 700 }}
                onClick={handleInstallUpdate}
              >
                Update & Restart Now
              </button>
              <button
                type="button"
                className="btn secondary-btn"
                style={{ padding: "8px 14px", fontSize: "0.88rem" }}
                onClick={() => setUpdateAvailable(null)}
              >
                Remind Me Later
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
