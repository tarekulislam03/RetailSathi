# Retail Sathi v0.1.6 - Production Stability Release

### 🚀 What's New & Improvements
- **Resolved Blank Screen in Production**: Injected production environment configuration into the release pipeline and added resilient fallback credentials for cloud synchronization.
- **Automated Release Notes**: GitHub Releases and auto-update manifests now properly populate comprehensive changelogs from `RELEASE_NOTES.md`.
- **Application Error Boundary**: Added crash-safe error diagnostics and restart actions to prevent silent UI failures.
- **Window Capability Synchronization**: Explicitly aligned the primary window identifier with Tauri capabilities.
- **Real-Time POS Counter & Sync**: Daily completed bills counter on POS search header and optimized cross-terminal sync.

---
*Retail Sathi Automatic Online Update System*
