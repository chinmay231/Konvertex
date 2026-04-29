#!/usr/bin/env node
/**
 * Mimik Scripter — Uninstall
 * Removes all installed dependencies: node_modules, .venv, and downloaded models.
 * Does NOT delete your project files or scripts.
 *
 * Usage: node uninstall.js
 *        node uninstall.js --all   (also removes the models/ folder)
 */

const fs   = require('fs');
const path = require('path');

const ROOT  = __dirname;
const DIRS  = ['node_modules', '.venv'];
const ARGS  = process.argv.slice(2);
const ALL   = ARGS.includes('--all');

function rm(dir) {
  const full = path.join(ROOT, dir);
  if (fs.existsSync(full)) {
    fs.rmSync(full, { recursive: true, force: true });
    console.log(`  \x1b[32m✔\x1b[0m  Removed: ${dir}/`);
  } else {
    console.log(`  \x1b[33m–\x1b[0m  Not found (skipped): ${dir}/`);
  }
}

console.log('\n\x1b[1mMimik Scripter — Uninstall\x1b[0m\n');

for (const dir of DIRS) rm(dir);

if (ALL) {
  rm('models');
  console.log('\n  Models removed. Re-run \x1b[1mnode setup.js\x1b[0m to reinstall everything.');
} else {
  console.log('\n  \x1b[34m→\x1b[0m  Models kept in models/. Use \x1b[1m--all\x1b[0m to remove them too.');
}

console.log('\n\x1b[32m\x1b[1mUninstall complete.\x1b[0m\n');
