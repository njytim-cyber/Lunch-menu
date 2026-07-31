#!/usr/bin/env node
/**
 * Concatenate icons/src into one sprite.
 *
 * Two source shapes are accepted:
 *   - a file holding a single <svg> drawing  -> becomes one <symbol>
 *     whose id is the filename
 *   - a file holding many <symbol> elements  -> passed through, ids kept
 *
 * Stroke presentation is applied on the symbol so individual drawings
 * stay free of repeated attributes, and `stroke="currentColor"` lets each
 * icon inherit its row's role colour.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'icons/src');
const outFile = join(root, 'icons/sprite.svg');

if (!existsSync(srcDir)) mkdirSync(srcDir, { recursive: true });

const PRESENTATION =
  'fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"';

const out = [];
let count = 0;

for (const file of readdirSync(srcDir).filter(f => f.endsWith('.svg')).sort()) {
  const raw = readFileSync(join(srcDir, file), 'utf8');

  if (raw.includes('<symbol')) {
    for (const [, open, body] of raw.matchAll(/<symbol([^>]*)>([\s\S]*?)<\/symbol>/g)) {
      const id = open.match(/id="([^"]+)"/)?.[1];
      if (!id) continue;
      const viewBox = open.match(/viewBox="([^"]+)"/)?.[1] ?? '0 0 24 24';
      out.push(`  <symbol id="${id}" viewBox="${viewBox}" ${PRESENTATION}>${body.trim()}</symbol>`);
      count++;
    }
    continue;
  }

  const id = file.replace(/\.svg$/, '');
  const viewBox = raw.match(/viewBox="([^"]+)"/)?.[1] ?? '0 0 24 24';
  const inner = raw.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').trim();
  out.push(`  <symbol id="${id}" viewBox="${viewBox}" ${PRESENTATION}>${inner}</symbol>`);
  count++;
}

writeFileSync(outFile, `<svg xmlns="http://www.w3.org/2000/svg" style="display:none">\n${out.join('\n')}\n</svg>\n`);
console.log(`Built icons/sprite.svg with ${count} symbol(s)`);
