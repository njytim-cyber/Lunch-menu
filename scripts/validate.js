#!/usr/bin/env node
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(root, 'data/dishes.json'), 'utf8'));

const errors = [];
const warnings = [];

// Unique, well-formed dish records
const seen = new Set();
for (const d of manifest.dishes) {
  if (seen.has(d.id)) errors.push(`Duplicate id: ${d.id}`);
  seen.add(d.id);
  if (!/^[a-z0-9-]+$/.test(d.id)) errors.push(`Malformed id: ${d.id}`);
  if (!d.name?.trim()) errors.push(`${d.id}: empty name`);
  if (!d.prep?.trim()) errors.push(`${d.id}: empty prep`);
  if (!d.meals?.length) errors.push(`${d.id}: no meals`);
  for (const meal of d.meals ?? []) {
    if (!manifest.categories[meal]?.includes(d.category)) {
      errors.push(`${d.id}: category "${d.category}" not valid for meal "${meal}"`);
    }
  }
  if (!d.description?.trim()) warnings.push(`${d.id}: empty description (blocks Phase 2 icon)`);
}

// Icon resolution against the built sprite
const spritePath = join(root, 'icons/sprite.svg');
if (existsSync(spritePath)) {
  const sprite = readFileSync(spritePath, 'utf8');
  const symbols = new Set([...sprite.matchAll(/<symbol[^>]+id="([^"]+)"/g)].map(m => m[1]));
  for (const d of manifest.dishes) {
    if (!symbols.has(d.icon)) warnings.push(`${d.id}: icon "${d.icon}" not in sprite (falls back)`);
  }
  const srcDir = join(root, 'icons/src');
  if (existsSync(srcDir)) {
    const used = new Set(manifest.dishes.map(d => d.icon));
    for (const f of readdirSync(srcDir).filter(f => f.endsWith('.svg'))) {
      const id = f.replace(/\.svg$/, '');
      // Underscore-prefixed marks (_fallback, _pin) are UI chrome, not dishes.
      if (!id.startsWith('_') && !used.has(id)) warnings.push(`Orphan icon: ${f}`);
    }
  }
} else {
  warnings.push('icons/sprite.svg missing — run `npm run build:icons`');
}

// Feasibility: pools must be deep enough for a no-repeat week
const dinner = manifest.dishes.filter(d => d.meals.includes('dinner'));
const lunch = manifest.dishes.filter(d => d.meals.includes('lunch'));
const veg = dinner.filter(d => d.category === 'vegetables');
if (veg.length < 7) errors.push(`Only ${veg.length} vegetables; need >= 7 for a no-repeat week`);
if (lunch.length < 7) errors.push(`Only ${lunch.length} lunch mains; need >= 7`);
if (!dinner.some(d => d.category === 'rice')) errors.push('No dinner rice dish');

for (const w of warnings) console.warn(`WARN  ${w}`);
for (const e of errors) console.error(`ERROR ${e}`);

console.log(`\n${manifest.dishes.length} dishes | ${errors.length} errors | ${warnings.length} warnings`);
process.exit(errors.length ? 1 : 0);
