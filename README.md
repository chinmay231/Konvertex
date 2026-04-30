# Mimik Scripter — Neural Voice Studio

Convert any script into high-quality audio narration.
Supports **online** (Microsoft Neural) and **offline** (Kokoro) modes.
No API keys required.

---

## For Coworkers — Just Run It

No installation needed. Download the zip for your operating system, unzip, and launch.

### Step 1 — Download the right zip

| Your OS | File to download |
|---|---|
| Linux (Ubuntu, Debian, etc.) | `mimik-scripter-linux.zip` |
| Windows 10 / 11 | `mimik-scripter-win.zip` |
| macOS (any — Intel or Apple Silicon) | `mimik-scripter-mac.zip` |

### Step 2 — Unzip

Extract the zip anywhere — Desktop, Documents, wherever you like.

### Step 3 — Launch

**Linux / Mac:**
```bash
./launch-mimik-scripter.sh
```

**Windows:**
Double-click `Launch Mimik Scripter.bat`

Your browser opens automatically at **http://localhost:8004**

---

## Terminal Commands (Start / Stop / Status / Uninstall)

Every zip includes a management script for full control from the terminal.

**Linux / Mac — `mimik.sh`**
```bash
./mimik.sh start      # start server and open browser
./mimik.sh stop       # stop the server
./mimik.sh status     # check if it's running
./mimik.sh uninstall  # stop and delete everything
```

**Windows — `mimik.bat`**
```bat
mimik.bat start
mimik.bat stop
mimik.bat status
mimik.bat uninstall
```

Logs are written to `mimik-scripter.log` in the same folder.

---

### Step 4 — Use it

That's it. No Node.js, no Python, no pip, no npm — nothing to install.

---

## Platform Compatibility

| OS | Architecture | Supported |
|---|---|---|
| Linux | x64 (most desktops/servers) | Yes |
| Windows | x64 | Yes |
| macOS | Apple Silicon (M1/M2/M3/M4) | Yes |
| macOS | Intel | Yes — runs via Rosetta 2 automatically |

> **Why separate builds per OS?**
> Each binary bundles a complete Node.js runtime and Python engine compiled for that platform.
> A Linux binary physically cannot run on Windows, and vice versa — the same way a Windows .exe won't open on a Mac.
> The zip for each platform is fully self-contained once built.

---

## Releasing a New Version (How to Ship to Users)

All builds happen automatically via GitHub Actions — you never need to build locally for distribution.

### Step 1 — Push your changes to `main`
```bash
git add .
git commit -m "your change description"
git push origin main
```
GitHub Actions will run a build on all 3 platforms to verify nothing is broken. No artifacts are stored at this stage.

### Step 2 — Create a GitHub Release
1. Go to **github.com/chinmay231/Konvertex → Releases → Draft a new release**
2. Click **"Choose a tag"** → type a new version tag (e.g. `v1.0.1`) → select **"Create new tag"**
3. Set the release title (e.g. `v1.0.1`) and describe what changed
4. Click **Publish release**

GitHub Actions automatically triggers a build for all 3 platforms. Once complete (~10–15 min), the zips are attached to the release page:
- `mimik-scripter-linux.zip`
- `mimik-scripter-win.zip`
- `mimik-scripter-mac.zip`

### Step 3 — Share the link
Send coworkers the GitHub Release URL. They pick the zip for their OS, unzip, and launch. Done.

> **Version naming:** Use `v1.0.0`, `v1.1.0`, `v2.0.0` — patch for bug fixes, minor for new features, major for breaking changes.

---

## Building Locally (Developers Only)

Normally you don't need this — use GitHub Releases instead. Local builds are useful for testing the build process itself.

### On a Windows machine:
```bash
node setup.js    # one-time: installs deps and downloads models
node build.js    # produces dist/win/  and  dist/mimik-scripter-win.zip
```

### On a Mac:
```bash
node setup.js
node build.js    # produces dist/mac/  and  dist/mimik-scripter-mac.zip
```

---

## How to Use the UI

1. **Paste or upload** your script — `.txt` file or paste directly into the text box
2. **Choose a mode** using the toggle at the top right:
   - **Online** — Microsoft Neural voices, internet required, 4 curated profiles
   - **Local** — Kokoro engine, fully offline, 27 individual characters
3. **Select a voice** — profile card (online) or character card (local)
4. **Adjust sliders** — hover `?` on any slider for a tip
5. Click **Generate Audio**
6. Audio plays automatically when ready — click **Download** to save the file

---

## Voice Modes

### Online — Microsoft Neural (4 Profiles, internet required)

| Profile | Voice | Personality | Best for |
|---|---|---|---|
| The Narrator | Andrew | Warm, Confident, Authentic | Tutorials, walkthroughs |
| The Guide | Emma | Clear, Cheerful, Conversational | Step-by-step explainers |
| The Presenter | Ava | Expressive, Caring, Friendly | Product demos |
| The Host | Brian | Approachable, Casual, Sincere | Informal guides |

### Local — Kokoro (27 Characters, fully offline)

| Group | Characters |
|---|---|
| American · Female | Heart, Bella, Sarah, Jessica, Nova, Alloy, Aoede, Kore, River, Sky, Nicole |
| American · Male | Michael, Adam, Liam, Eric, Echo, Onyx, Fenrir, Puck |
| British · Female | Emma, Alice, Isabella, Lily |
| British · Male | George, Daniel, Lewis, Fable |

---

## Slider Reference

| Slider | Range | Tip | Local mode |
|---|---|---|---|
| Speed | Slow (−20%) → Fast (+20%) | `−5%` feels natural for narration | Supported |
| Volume | Normal (0%) → Max (+50%) | `+15%` sits well in a video mix | Supported |
| Clarity / Pitch | Lower (−10 Hz) → Higher (+20 Hz) | `+5–8 Hz` sharpens "s" sounds | Not available |

---

## For Developers — Run from Source

Requires Node.js 18+ and Python 3.8+.

```bash
git clone <your-repo-url>
cd tts_videos
node setup.js       # installs everything including Kokoro models
node scripter.js    # start the server
# → http://localhost:8004
```

### Build a distributable zip

```bash
node build.js                          # build for current OS
node build.js --platform win           # build Windows (must run on Windows)
node build.js --skip-python            # online mode only, no Python required
```

Output goes to `dist/mimik-scripter-<platform>.zip`.

### Uninstall

```bash
node uninstall.js          # removes node_modules and .venv
node uninstall.js --all    # also removes the 115 MB model files
```

---

## Changing the Port

Default port is **8004**. When running from source:

```bash
PORT=9000 node scripter.js             # macOS / Linux
set PORT=9000 && node scripter.js      # Windows Command Prompt
$env:PORT=9000; node scripter.js       # Windows PowerShell
```

---

## Project Structure

```
tts_videos/
├── scripter.js        ← Express backend
├── setup.js           ← One-time installer (dev mode)
├── build.js           ← Builds self-contained distributable zip
├── uninstall.js       ← Clean uninstaller
├── kokoro_tts.py      ← Local TTS subprocess (runs in .venv or as binary)
├── ROADMAP.md         ← Electron + size reduction plans
├── public/
│   ├── index.html
│   ├── app.js
│   ├── style.css
│   └── logo.svg
├── models/            ← Kokoro model files (downloaded by setup.js)
│   ├── kokoro-v1.0.int8.onnx
│   └── voices-v1.0.bin
├── dist/              ← Built distributable zips (produced by build.js)
│   ├── linux/
│   ├── win/
│   └── mimik-scripter-linux.zip
├── .venv/             ← Python virtual environment (created by setup.js)
└── node_modules/
```
