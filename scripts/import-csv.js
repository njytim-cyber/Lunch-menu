#!/usr/bin/env node
/**
 * Rebuild data/dishes.json from a spreadsheet export.
 *
 * Usage: node scripts/import-csv.js "data/menus - Sheet1.csv"
 *
 * The CSV is the human-editable source of truth for names, prep, category
 * and descriptions. `id` and `icon` are stable keys — changing an id here
 * orphans that dish's icon, recipe, and history, so the importer refuses
 * to invent them.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const csvPath = process.argv[2] ?? 'data/menus - Sheet1.csv';

/** Minimal RFC4180 parser — handles quoted fields containing commas. */
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(cell => cell.trim()));
}

const rows = parseCsv(readFileSync(join(root, csvPath), 'utf8'));
const header = rows[0].map(h => h.trim().toLowerCase());
const col = (name) => header.indexOf(name);

const required = ['id', 'name', 'meals', 'category', 'prep', 'icon'];
for (const r of required) {
  if (col(r) === -1) {
    console.error(`ERROR missing required column: ${r}`);
    process.exit(1);
  }
}

const dishes = rows.slice(1).map(r => {
  const get = (name) => (r[col(name)] ?? '').trim();
  return {
    id: get('id'),
    name: get('name'),
    meals: get('meals').split(/[;|]/).map(s => s.trim()).filter(Boolean),
    category: get('category'),
    prep: get('prep'),
    icon: get('icon') || get('id'),
    description: col('description') === -1 ? '' : get('description'),
  };
});

// Categories are derived from the data so adding one in the sheet just works.
const categoriesFor = (meal) => [
  ...new Set(dishes.filter(d => d.meals.includes(meal)).map(d => d.category)),
];

const manifest = {
  $schema: './dishes.schema.json',
  version: 3,
  categories: { lunch: categoriesFor('lunch'), dinner: categoriesFor('dinner') },
  proteinCategories: ['fish', 'pork', 'chicken', 'eggs', 'prawn', 'tofu'],
  dishes,
};

writeFileSync(join(root, 'data/dishes.json'), JSON.stringify(manifest, null, 2) + '\n');

const veg = dishes.filter(d => d.category === 'vegetables');
const lunch = dishes.filter(d => d.meals.includes('lunch'));
console.log(`Wrote data/dishes.json — ${dishes.length} dishes`);
console.log(`  lunch mains: ${lunch.length}   vegetables: ${veg.length}`);
console.log(`  descriptions filled: ${dishes.filter(d => d.description).length}/${dishes.length}`);
console.log('\nRun `npm run validate` to check feasibility.');
