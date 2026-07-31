#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'icons/src');
const outFile = join(root, 'icons/sprite.svg');

if (!existsSync(srcDir)) mkdirSync(srcDir, { recursive: true });

const files = readdirSync(srcDir).filter(f => f.endsWith('.svg')).sort();
const symbols = files.map(file => {
  const id = file.replace(/\.svg$/, '');
  const raw = readFileSync(join(srcDir, file), 'utf8');

  const viewBox = raw.match(/viewBox="([^"]+)"/)?.[1] ?? '0 0 24 24';
  // Strip the outer <svg> wrapper, keeping only its children.
  const inner = raw.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').trim();

  return `  <symbol id="${id}" viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">\n${inner}\n  </symbol>`;
}).join('\n');

writeFileSync(outFile, `<svg xmlns="http://www.w3.org/2000/svg" style="display:none">\n${symbols}\n</svg>\n`);
console.log(`Built icons/sprite.svg with ${files.length} symbol(s)`);
