#!/usr/bin/env node
/**
 * Mimik Scripter — Build (Option A)
 *
 * Produces a fully self-contained distributable in dist/<platform>/
 * No Node.js or Python required on the target machine.
 *
 * Usage:
 *   node build.js                  build for current platform
 *   node build.js --platform win   build Windows x64 (cross-compile JS only;
 *                                  Python binary must be built on Windows)
 *   node build.js --skip-python    skip PyInstaller step (online mode only)
 *   node build.js --all            build linux + win + mac (JS only)
 */

const { execSync, spawnSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

const ROOT   = __dirname;
const IS_WIN = process.platform === 'win32';
const IS_MAC = process.platform === 'darwin';

const ARGS         = process.argv.slice(2);
const SKIP_PYTHON  = ARGS.includes('--skip-python');
const BUILD_ALL    = ARGS.includes('--all');
const PLATFORM_ARG = ARGS.find(a => a.startsWith('--platform='))?.split('=')[1]
  || (ARGS[ARGS.indexOf('--platform') + 1]);

const VENV_PYI = IS_WIN
  ? path.join(ROOT, '.venv', 'Scripts', 'pyinstaller.exe')
  : path.join(ROOT, '.venv', 'bin', 'pyinstaller');
const PKG = path.join(ROOT, 'node_modules', '.bin', 'pkg');

const PKG_TARGETS = {
  linux: 'node18-linux-x64',
  win:   'node18-win-x64',
  mac:   'node18-mac-arm64',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function ok(msg)   { console.log(`  \x1b[32m✔\x1b[0m  ${msg}`); }
function info(msg) { console.log(`\n  \x1b[34m→\x1b[0m  ${msg}`); }
function warn(msg) { console.log(`  \x1b[33m⚠\x1b[0m  ${msg}`); }

function run(cmd, opts = {}) {
  execSync(cmd, { stdio: 'inherit', cwd: ROOT, ...opts });
}

function sizeMB(p) {
  try {
    const res = spawnSync('du', ['-sh', p], { encoding: 'utf8' });
    return res.stdout.split('\t')[0];
  } catch { return '?'; }
}

// ── Steps ─────────────────────────────────────────────────────────────────────

function checkTools() {
  if (!fs.existsSync(PKG)) {
    console.error('\n  pkg not found. Run: npm install\n');
    process.exit(1);
  }
  if (!fs.existsSync(VENV_PYI) && !SKIP_PYTHON) {
    console.error('\n  PyInstaller not found in .venv. Run: node setup.js\n');
    process.exit(1);
  }
  ok('Build tools ready');
}

function buildPython(distDir) {
  if (SKIP_PYTHON) {
    warn('Skipping Python build — local (Kokoro) mode will not work in packaged binary');
    return;
  }
  if (!fs.existsSync(VENV_PYI)) {
    warn('PyInstaller not found — install it with: node setup.js');
    return;
  }

  info('Building kokoro_tts binary with PyInstaller...');

  const workDir = path.join(ROOT, '.pyibuild');
  fs.mkdirSync(workDir, { recursive: true });

  // Exclusions reduce bundle size significantly
  const excludes = [
    'matplotlib', 'PIL', 'Pillow', 'tkinter', 'scipy',
    'pandas', 'IPython', 'jupyter', 'notebook', 'test',
    'unittest', 'xmlrpc', 'email', 'html', 'http.server',
    'pydoc', 'doctest', 'difflib'
  ].map(m => `--exclude-module ${m}`).join(' ');

  run([
    VENV_PYI,
    'kokoro_tts.py',
    '--onefile',
    '--name kokoro_tts',
    '--distpath', distDir,
    '--workpath', workDir,
    '--specpath', workDir,
    '--noconfirm',
    '--log-level WARN',
    excludes
  ].join(' '));

  // Clean up build artefacts
  fs.rmSync(workDir, { recursive: true, force: true });

  const binName = IS_WIN ? 'kokoro_tts.exe' : 'kokoro_tts';
  const binPath = path.join(distDir, binName);
  if (fs.existsSync(binPath)) {
    ok(`kokoro_tts binary → ${sizeMB(binPath)}`);
  } else {
    warn('PyInstaller finished but binary not found — check output above');
  }
}

function buildNode(distDir, pkgTarget) {
  info(`Building scripter binary with pkg (${pkgTarget})...`);
  run([
    PKG,
    'scripter.js',
    '--target', pkgTarget,
    '--output', path.join(distDir, 'mimik-scripter'),
    '--compress', 'GZip'
  ].join(' '));

  const binName = pkgTarget.includes('win') ? 'mimik-scripter.exe' : 'mimik-scripter';
  ok(`mimik-scripter binary → ${sizeMB(path.join(distDir, binName))}`);
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function copyModels(distDir) {
  info('Copying models...');
  const dest = path.join(distDir, 'models');
  copyDir(path.join(ROOT, 'models'), dest);
  ok(`models/ → ${sizeMB(dest)}`);
}

function copyPublic(distDir) {
  info('Copying public/...');
  const dest = path.join(distDir, 'public');
  copyDir(path.join(ROOT, 'public'), dest);
  ok(`public/ copied`);
}

function writeLauncher(distDir, isWin) {
  if (isWin) {
    // Run server in same window so output is visible; open browser in background
    const bat = [
      '@echo off',
      'cd /d "%~dp0"',
      'echo Starting Mimik Scripter...',
      'start /b cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:8004"',
      'mimik-scripter.exe',
    ].join('\r\n') + '\r\n';
    fs.writeFileSync(path.join(distDir, 'Launch Mimik Scripter.bat'), bat);
  } else {
    // Open browser in background; run server in foreground so terminal stays open
    const sh = [
      '#!/bin/bash',
      'DIR="$(cd "$(dirname "$0")" && pwd)"',
      'echo "Starting Mimik Scripter..."',
      '(sleep 2 && open http://localhost:8004 2>/dev/null || sleep 2 && xdg-open http://localhost:8004 2>/dev/null) &',
      '"$DIR/mimik-scripter"',
    ].join('\n') + '\n';
    const p = path.join(distDir, 'launch-mimik-scripter.sh');
    fs.writeFileSync(p, sh);
    fs.chmodSync(p, 0o755);
  }
  ok('Launcher script created');
}

function writeReadme(distDir) {
  const txt = `Mimik Scripter
==============

1. Run the launcher:
   - Windows: double-click "Launch Mimik Scripter.bat"
   - Mac/Linux: run ./launch-mimik-scripter.sh

2. Your browser will open automatically at http://localhost:8004

3. To stop: close the terminal window.

No installation required. Internet needed for Online mode only.
Local (Kokoro) mode works fully offline.

To uninstall: close the app and delete this folder. Nothing else to remove.
`;
  fs.writeFileSync(path.join(distDir, 'README.txt'), txt);
}

function zipDist(distDir, label) {
  const zipName = `mimik-scripter-${label}.zip`;
  const zipPath = path.join(ROOT, 'dist', zipName);
  info(`Creating ${zipName}...`);
  try {
    if (IS_WIN) {
      run(`powershell -Command "Compress-Archive -Path '${distDir}\\*' -DestinationPath '${zipPath}' -Force"`);
    } else {
      run(`zip -r "${zipPath}" .`, { cwd: distDir });
    }
    ok(`Package → dist/${zipName}  (${sizeMB(zipPath)})`);
  } catch (e) {
    warn(`Zip failed: ${e.message}`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function buildFor(platformKey, pkgTarget) {
  const label   = platformKey;
  const distDir = path.join(ROOT, 'dist', label);
  fs.mkdirSync(distDir, { recursive: true });

  console.log(`\n\x1b[1m  Building for: ${label}\x1b[0m`);

  buildPython(distDir);
  buildNode(distDir, pkgTarget);
  copyModels(distDir);
  copyPublic(distDir);
  writeLauncher(distDir, platformKey === 'win');
  writeReadme(distDir);
  zipDist(distDir, label);
}

function detectCurrentPlatform() {
  if (IS_WIN) return 'win';
  if (IS_MAC) return 'mac';
  return 'linux';
}

async function main() {
  console.log('\n\x1b[1mMimik Scripter — Build\x1b[0m');
  checkTools();

  if (BUILD_ALL) {
    for (const [key, target] of Object.entries(PKG_TARGETS)) {
      if (key === 'macarm') continue; // skip unless on ARM
      await buildFor(key, target);
    }
  } else {
    const platform = PLATFORM_ARG || detectCurrentPlatform();
    const target   = PKG_TARGETS[platform];
    if (!target) {
      console.error(`Unknown platform: ${platform}. Use: linux, win, mac, macarm`);
      process.exit(1);
    }
    if (platform !== detectCurrentPlatform() && !SKIP_PYTHON) {
      warn(`Cross-platform build detected. PyInstaller cannot cross-compile.`);
      warn(`The kokoro_tts binary must be built natively on ${platform}.`);
      warn(`JS binary will still be built. Add --skip-python to suppress this.`);
    }
    await buildFor(platform, target);
  }

  console.log('\n\x1b[32m\x1b[1mBuild complete.\x1b[0m\n');
  console.log('  Distribute the zip from dist/ — users need no Node.js or Python.\n');
}

main().catch(e => { console.error(`\n  Error: ${e.message}\n`); process.exit(1); });
