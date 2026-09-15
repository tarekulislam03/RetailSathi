<div align="center">

<h1>CHRONO Terminal</h1>

<h3>Retro 16-Bit Pixel-Art Desktop Terminal Emulator & Unix Shell</h3>

English | [Documentation](./README.md)

<!-- badges -->

[![C](https://img.shields.io/badge/c-GCC%20%7C%20Clang-00599C?logo=c&logoColor=white)](https://gcc.gnu.org/)
[![Rust](https://img.shields.io/badge/rust-v1.75+-000000?logo=rust&logoColor=white)](https://www.rust-lang.org/)
[![Tauri](https://img.shields.io/badge/tauri-v2.0-FFC131?logo=tauri&logoColor=black)](https://tauri.app/)
[![xterm.js](https://img.shields.io/badge/xterm.js-v5.5.0-00F0FF?logo=javascript&logoColor=black)](https://xtermjs.org/)
[![OS](https://img.shields.io/badge/os-linux%2C%20win%2C%20mac-pink.svg)](#quick-start-guide)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

</div>

<br />

**CHRONO is a high-performance desktop terminal emulator and custom C Unix shell with dynamic color themes, smart clipboard handling, and frameless window controls.**

---

## Quick Start Guide

### Step 1: Prerequisites
* **C Compiler:** `gcc` or `clang`
* **C Libraries:** `libreadline-dev`
* **Rust Toolchain:** `rustc` & `cargo` (`>= 1.75`)
* **Node.js:** `v18` or higher

### Step 2: Installation & Compilation

```bash
# Clone repository
git clone https://github.com/tarekulislam03/Chrono.git
cd Chrono

# Build core C shell binary
make clean && make

# Install terminal frontend dependencies
cd chrono-terminal
npm install
```

### Step 3: Launch Application

```bash
# Run in development mode
npm run tauri dev
```

### Step 4: Build Release Installer

```bash
# Compile standalone application package
npm run tauri build
```

---

## Project Structure

```
Chrono/
├── chrono.c              # C shell main loop, prompt renderer & command parser
├── ui.c                  # System info, matrix animation & terminal helper functions
├── ui.h                  # Header declarations & ANSI color macros
├── Makefile              # C compilation rules
│
├── chrono-terminal/
│   ├── src/
│   │   ├── index.html    # Main window DOM structure
│   │   ├── main.js       # xterm.js setup, PTY IPC listener & theme manager
│   │   ├── styles.css    # Layout rules, window styling & gradient overlays
│   │   └── pixel_bg.png  # Default pixel-art background image
│   │
│   └── src-tauri/
│       ├── src/lib.rs    # Tauri command handlers, PTY management & IPC events
│       ├── Cargo.toml    # Rust dependencies (tauri, portable-pty)
│       └── tauri.conf.json # Window layout & security configuration
│
└── README.md             # Project documentation
```

---

## Built-In Commands Reference

* `theme <name>`: Switch active visual theme (`sunset`, `cyberpunk`, `forest`, `synthwave`, `matrix`).
* `sysinfo`: Display system hardware specifications, memory usage, and kernel information.
* `matrix`: Trigger retro digital code rain animation.
* `scan <target>`: Run simulated network port scan.
* `cd <dir>`: Navigate to target directory.
* `help`: Display list of shell commands.

---

## License

Distributed under the **MIT License**. See `LICENSE` for details.

---

<div align="center">
  <sub>Built for high-speed terminal productivity and retro 16-bit aesthetics.</sub>
</div>
