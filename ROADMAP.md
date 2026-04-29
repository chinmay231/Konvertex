# Mimik Scripter — Roadmap

---

## Current: Option A — Self-contained Binary (pkg + PyInstaller)

**Status: Done**

| Component | Technology | Size |
|---|---|---|
| Node.js server + UI | pkg binary | ~35 MB |
| Python TTS engine | PyInstaller binary | ~100 MB |
| Kokoro model files | external | ~116 MB |
| **Total distributable** | | **~250 MB** |

**User experience:** unzip → double-click launcher → browser opens at localhost:8004

---

## Next: Option C — Electron Desktop App

**Goal:** Real desktop app. No browser needed. Proper installer (.msi / .dmg / .deb).

### What changes

| Area | Change |
|---|---|
| Shell | Add Electron wrapper — opens its own window, no manual browser step |
| Backend | `scripter.js` becomes an Electron main-process child, started on app launch |
| UI | `public/` served inside Electron's webview — zero code changes to HTML/CSS/JS |
| Python | Same PyInstaller binary for Kokoro — no change |
| Distribution | `electron-builder` produces signed .msi (Win), .dmg (Mac), .AppImage (Linux) |
| Auto-update | `electron-updater` — users get notified and update in one click |

### Key files to add

```
electron/
├── main.js          ← Electron entry point — launches scripter.js, opens window
├── preload.js       ← Context bridge (if needed for IPC)
└── tray.js          ← Optional: system tray icon with open/quit
electron-builder.yml ← Build config: icons, targets, signing
```

### `electron/main.js` skeleton

```js
const { app, BrowserWindow, shell } = require('electron');
const { fork } = require('child_process');
const path = require('path');

let win, server;

app.whenReady().then(() => {
  // Start the Express server as a child process
  server = fork(path.join(__dirname, '..', 'scripter.js'));

  win = new BrowserWindow({ width: 1200, height: 800 });
  // Wait for server to start, then load UI
  setTimeout(() => win.loadURL('http://localhost:8004'), 1500);
});

app.on('window-all-closed', () => {
  server?.kill();
  app.quit();
});
```

### Build commands (once Electron is added)

```bash
npm install --save-dev electron electron-builder

# Dev
npx electron electron/main.js

# Package
npx electron-builder --win    # → .msi + .exe installer
npx electron-builder --mac    # → .dmg
npx electron-builder --linux  # → .AppImage + .deb
```

### Estimated timeline

| Task | Effort |
|---|---|
| Add `electron/main.js` + server launch | 2 hours |
| Test UI inside Electron webview | 1 hour |
| electron-builder config + icons | 2 hours |
| Code signing setup (Win + Mac) | 1 day (certificates needed) |
| Auto-update integration | 3 hours |
| **Total** | **~2 days** |

---

## Size Reduction Roadmap

Current distributable is ~250 MB. Target: ~130 MB. Here is the path:

### Phase 1 — Done (current build)
- [x] Replace `soundfile` with stdlib `wave` → saves ~30 MB from PyInstaller bundle
- [x] PyInstaller `--exclude-module` for unused packages → saves ~20 MB
- [x] pkg `--compress GZip` → saves ~10 MB from Node binary

### Phase 2 — Medium effort (~130–160 MB total)

**UPX compression on both binaries**
UPX compresses executables by 40–60% without any quality loss.
Requires `upx` on the build machine (`apt install upx-ucl` / `brew install upx`).
```bash
upx --best dist/linux/mimik-scripter
upx --best dist/linux/kokoro_tts
# Estimated saving: ~50–60 MB
```

**Lazy model download (on first use)**
Instead of shipping models in the zip, download them automatically on first launch.
Reduces distributable from ~250 MB to ~130 MB. Models cached locally after first run.
```
User downloads: mimik-scripter (~130 MB zip)
First launch: "Downloading voice model (116 MB)..." progress bar
Subsequent launches: instant
```

### Phase 3 — Bigger effort (~60–80 MB total)

**Replace Kokoro ONNX with a WASM TTS engine**
Eliminates Python entirely — no PyInstaller binary needed.
Run TTS inside the browser/Node using WebAssembly.
Options:
- `sherpa-onnx-wasm` — ONNX runtime compiled to WASM
- `kokoro.js` — if a JS port becomes stable
Estimated saving: removes ~100 MB (PyInstaller binary gone, model still needed)

**Smaller model variant**
The int8 model (89 MB) is already quantized. Further options:
- int4 quantization: ~45 MB, slight quality degradation on some voices
- Voice-selective loading: only bundle the 3–4 most popular voices instead of all 28
  → voices.bin: 27 MB → ~5 MB if trimmed to 4 voices

**Total achievable (Phase 3 + lazy download):**
```
mimik-scripter binary (pkg, no Python):  ~20 MB
models/ (downloaded on first run):        ~0 MB in zip
Total zip:                               ~20 MB
First-run download:                      ~116 MB (cached forever)
```

---

## CI/CD — Multi-platform Builds

Building for all platforms requires native runners per OS (PyInstaller cannot cross-compile).

```yaml
# .github/workflows/build.yml
jobs:
  build:
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with: { node-version: 18 }
      - uses: actions/setup-python@v4
        with: { python-version: '3.11' }
      - run: node setup.js
      - run: node build.js
      - uses: actions/upload-artifact@v3
        with:
          name: mimik-scripter-${{ runner.os }}
          path: dist/*.zip
```

This produces all three platform zips automatically on every push to `main`.
