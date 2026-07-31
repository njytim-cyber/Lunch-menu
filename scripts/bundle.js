#!/usr/bin/env node
/**
 * Stage exactly the files the site needs into dist/, and zip it.
 *
 * Exists because wrangler cannot be installed on Windows ARM64 (workerd
 * ships no win32-arm64 build), so `wrangler pages deploy` is unavailable
 * locally. dist.zip can be dragged straight into the Cloudflare Pages
 * dashboard instead.
 *
 * Mirrors .assetsignore: source, tooling, tests and docs stay out.
 */
import { cpSync, mkdirSync, rmSync, existsSync, statSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

const INCLUDE = [
  'index.html',
  'favicon.svg',
  'manifest.webmanifest',
  'sw.js',
  'styles',
  'js',
  'data/dishes.json',
  'icons/sprite.svg',
];

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

for (const rel of INCLUDE) {
  const from = join(root, rel);
  if (!existsSync(from)) {
    console.error(`ERROR missing: ${rel}`);
    process.exit(1);
  }
  const to = join(dist, rel);
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true });
}

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap(e =>
  e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]);

const files = walk(dist);
const bytes = files.reduce((n, f) => n + statSync(f).size, 0);

// PowerShell's Compress-Archive is always present on Windows; zip elsewhere.
const zip = join(root, 'dist.zip');
rmSync(zip, { force: true });
try {
  if (process.platform === 'win32') {
    execFileSync('powershell', ['-NoProfile', '-Command',
      `Compress-Archive -Path '${dist}\\*' -DestinationPath '${zip}' -Force`], { stdio: 'ignore' });
  } else {
    execFileSync('zip', ['-qr', zip, '.'], { cwd: dist, stdio: 'ignore' });
  }
  console.log(`Wrote dist/ and dist.zip — ${files.length} files, ${(bytes / 1024).toFixed(0)} KB`);
} catch {
  console.log(`Wrote dist/ — ${files.length} files, ${(bytes / 1024).toFixed(0)} KB (zip step skipped)`);
}

for (const f of files.sort()) console.log(`  ${f.replace(dist + '\\', '').replace(dist + '/', '')}`);
