#!/usr/bin/env node
/**
 * Mimik Scripter — Setup
 * Run once after downloading the project: node setup.js
 */

const { execSync, spawnSync } = require('child_process');
const https  = require('https');
const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const os     = require('os');

const ROOT       = __dirname;
const VENV_DIR   = path.join(ROOT, '.venv');
const MODEL_DIR  = path.join(ROOT, 'models');
const MODEL_FILE = path.join(MODEL_DIR, 'kokoro-v1.0.int8.onnx');
const VOICES_FILE= path.join(MODEL_DIR, 'voices-v1.0.bin');

const IS_WIN  = process.platform === 'win32';
const PYTHON  = IS_WIN ? 'python' : 'python3';
const PIP     = IS_WIN
  ? path.join(VENV_DIR, 'Scripts', 'pip.exe')
  : path.join(VENV_DIR, 'bin', 'pip3');
const VENV_PY = IS_WIN
  ? path.join(VENV_DIR, 'Scripts', 'python.exe')
  : path.join(VENV_DIR, 'bin', 'python3');

const MODEL_URL  = 'https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.int8.onnx';
const VOICES_URL = 'https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin';

const PY_PACKAGES = ['pyinstaller', 'kokoro-onnx', 'soundfile', 'numpy'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function log(msg)  { console.log(`  ${msg}`); }
function ok(msg)   { console.log(`  \x1b[32m✔\x1b[0m  ${msg}`); }
function info(msg) { console.log(`  \x1b[34m→\x1b[0m  ${msg}`); }
function err(msg)  { console.error(`  \x1b[31m✖\x1b[0m  ${msg}`); }

function run(cmd, opts = {}) {
  execSync(cmd, { stdio: 'inherit', cwd: ROOT, ...opts });
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const get  = url.startsWith('https') ? https : http;

    const doGet = (url) => {
      get.get(url, res => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return doGet(res.headers.location);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        }
        const total = parseInt(res.headers['content-length'] || '0', 10);
        let done = 0;
        res.on('data', chunk => {
          done += chunk.length;
          if (total) {
            const pct = Math.round((done / total) * 100);
            process.stdout.write(`\r  \x1b[34m→\x1b[0m  Downloading... ${pct}%`);
          }
        });
        res.pipe(file);
        file.on('finish', () => { file.close(); process.stdout.write('\n'); resolve(); });
      }).on('error', reject);
    };

    doGet(url);
  });
}

// ── Steps ─────────────────────────────────────────────────────────────────────

async function checkNode() {
  const ver = process.versions.node.split('.')[0];
  if (parseInt(ver) < 18) {
    err(`Node.js 18+ required. Found: v${process.versions.node}`);
    process.exit(1);
  }
  ok(`Node.js v${process.versions.node}`);
}

async function checkPython() {
  const res = spawnSync(PYTHON, ['--version']);
  if (res.status !== 0) {
    err(`Python 3 not found. Install from https://python.org`);
    process.exit(1);
  }
  const ver = res.stdout?.toString().trim() || res.stderr?.toString().trim();
  ok(ver);
}

async function createVenv() {
  if (fs.existsSync(VENV_PY)) {
    ok('Python venv already exists — skipping');
    return;
  }
  info('Creating Python virtual environment (.venv/)...');
  run(`${PYTHON} -m venv ${VENV_DIR}`);
  ok('Virtual environment created');
}

async function installPyPackages() {
  info(`Installing Python packages: ${PY_PACKAGES.join(', ')}`);
  run(`${VENV_PY} -m pip install --upgrade pip --quiet`);
  run(`${PIP} install ${PY_PACKAGES.join(' ')} --quiet`);
  ok('Python packages installed');
}

async function installNodePackages() {
  if (fs.existsSync(path.join(ROOT, 'node_modules'))) {
    ok('node_modules already exists — skipping');
    return;
  }
  info('Installing Node.js packages...');
  run('npm install --silent');
  ok('Node.js packages installed');
}

async function downloadModels() {
  fs.mkdirSync(MODEL_DIR, { recursive: true });

  if (fs.existsSync(MODEL_FILE)) {
    ok('Kokoro model already downloaded — skipping');
  } else {
    info(`Downloading Kokoro model (~85 MB) to models/...`);
    await downloadFile(MODEL_URL, MODEL_FILE);
    ok('Kokoro model downloaded');
  }

  if (fs.existsSync(VOICES_FILE)) {
    ok('Voices file already downloaded — skipping');
  } else {
    info('Downloading voices file (~27 MB)...');
    await downloadFile(VOICES_URL, VOICES_FILE);
    ok('Voices file downloaded');
  }
}

async function main() {
  console.log('\n\x1b[1mMimik Scripter — Setup\x1b[0m\n');

  await checkNode();
  await checkPython();
  await installNodePackages();
  await createVenv();
  await installPyPackages();
  await downloadModels();

  console.log('\n\x1b[32m\x1b[1mSetup complete.\x1b[0m\n');
  console.log('  Run the app:   \x1b[1mnode scripter.js\x1b[0m');
  console.log('  Open browser:  \x1b[1mhttp://localhost:8004\x1b[0m\n');
}

main().catch(e => { err(e.message); process.exit(1); });
