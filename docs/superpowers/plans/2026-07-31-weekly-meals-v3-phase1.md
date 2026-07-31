# Weekly Meals v3 — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the weekly meal planner on a state-as-truth architecture with one-button lunch+dinner generation that uses 12-week history to avoid repeats, and an Apple-style UI — excluding the 49 bespoke dish SVGs, which are Phase 2.

**Architecture:** A single store holds all state; the DOM is a pure render of it and never a source of truth. Dish data moves from 53 imperative `addFoodItem()` calls into a declarative `data/dishes.json` manifest with orthogonal `category` and `prep` axes. Generation scores candidates by `(weeks_since_last_use)²` modulated by category and prep rotation caps, sampling proportionally. All 20 `window.*` globals and all 16 inline `onclick=""` attributes are replaced by one delegated `data-action` dispatcher.

**Tech Stack:** Vanilla ES modules, no runtime dependencies. Vitest for tests (dev-only). Node 24 / npm 11. Cloudflare Pages serves static files; `wrangler.jsonc` keeps `assets.directory = "."`.

## Global Constraints

- **Zero runtime dependencies.** Vitest is `devDependencies` only. The deployed site loads no npm package.
- **No build step required to serve.** Build scripts (`build-sprite.js`, `validate.js`) produce committed artifacts; Cloudflare serves static files as today.
- **No emoji anywhere in UI output.** Phase 1 renders every dish with the single generic fallback icon.
- **`id` fields in `data/dishes.json` are frozen.** Names, `prep`, `category`, and `description` are user-editable in parallel; never rewrite an `id`.
- **Do not modify `data/dishes.json`.** It is under concurrent human edit. Read it; never write it.
- **Storage key:** `weeklyMeals_v3`. Legacy keys `weeklyMealPlan_v1`, `customDishes_v1`, `recipes_v1` are read for migration and left in place for rollback.
- **Retention:** `weeks` holds at most 13 entries — the current week plus 12 of history.
- **State shape is fixed** (see spec §6). Never reintroduce a `current`/`history` split, a parallel `locks` tree, or day-name-keyed objects:

```js
{
  version: 3,
  weeks: [                       // newest first; weeks[0] IS the current week
    { weekOf: "2026-07-27",
      lunch:  [ [{id:"bee-hoon"}], [], [], [], [], [], [] ],   // 7 fixed slots, Mon..Sun
      dinner: [ [{id:"rice"},{id:"curry-chicken",lock:true}], [], … ] }
  ],
  custom:  [ { id, name, meals, category, prep, icon } ],
  recipes: { [dishId]: "free text" }
}
```

- **All plan access goes through `js/core/plan.js` accessors.** No task indexes `weeks[0].lunch[3]` directly.
- **Locks live on the placement** (`{id, lock: true}`), never in a parallel structure. `clearMeal` keeps locked placements and drops the rest.
- **Dinner composition:** rice (always) + 1 vegetable + 1 protein + optional soup at p=0.4 → 3–4 items.
- **Lunch composition:** exactly 1 main per day.
- **Rotation caps per week:** protein category ≤ 2 nights; `prep: fried` ≤ 2 dinners; `prep: soup` ≤ 2 lunches.
- **Hard guarantee:** no dish repeats within a single generated week. Rotation caps relax before this guarantee does.
- **All randomness injectable.** Every function using randomness accepts `rng = Math.random` as its last parameter so tests are deterministic.
- **Version:** bump to `3.0.0` in `package.json` and `js/version.js` together (existing semver rule in `.cursor/rules/semver.mdc`).

---

## File Structure

**Created:**

| Path | Responsibility |
|---|---|
| `data/dishes.schema.json` | JSON Schema for the manifest; used by `validate.js` |
| `js/core/week.js` | ISO-Monday week keys and arithmetic |
| `js/core/plan.js` | Week/placement shape and every accessor over it |
| `js/core/persistence.js` | localStorage read/write + v1→v3 migration |
| `js/core/store.js` | Single source of truth, subscribe/notify |
| `js/core/history.js` | Rollover, retention trim, last-used index |
| `js/domain/dishes.js` | Load and index the manifest |
| `js/domain/generator.js` | Weighted-LRU selection with rotation caps |
| `js/ui/icons.js` | Sprite injection and `<use>` helper |
| `js/ui/actions.js` | Delegated `data-action` dispatch |
| `js/ui/day-card.js` | Render the 7-day grid from state |
| `js/ui/picker.js` | Bottom sheet / desktop sidebar dish picker |
| `js/ui/modals.js` | Add-dish, recipe, confirm, help, version modals |
| `js/ui/history-view.js` | Browse past weeks |
| `js/main.js` | Entry: wire store → render → events |
| `styles/tokens.css` | Design tokens |
| `styles/base.css` | Reset and typography |
| `styles/layout.css` | Grid and day cards |
| `styles/components.css` | Buttons, sheets, modals, toasts |
| `styles/main.css` | `@import`s the above |
| `icons/src/_fallback.svg` | Generic dish mark — stands in for all 49 dishes in Phase 1 |
| `icons/src/_pin.svg` | Pin toggle mark on each placed dish |
| `icons/sprite.svg` | Built sprite (committed artifact) |
| `scripts/build-sprite.js` | Concatenate `icons/src/*.svg` → sprite |
| `scripts/validate.js` | Assert every `dish.icon` resolves; flag orphans |
| `manifest.webmanifest`, `sw.js`, `favicon.svg` | PWA basics |
| `tests/*.test.js` | Vitest suites |

**Deleted:** `master_styles.css`, `master_styles_utf8.css`, `js/ui.js`, `js/data.js`, `js/state.js`, `js/suggest.js`, `js/share.js`, `js/app.js`, `styles.css`.

**Modified:** `index.html` (markup rewrite), `package.json`, `.assetsignore`, `js/version.js`.

---

## Task 1: Scaffolding, dead-asset removal, and test harness

**Files:**
- Modify: `package.json`
- Modify: `.assetsignore`
- Delete: `master_styles.css`, `master_styles_utf8.css`
- Create: `vitest.config.js`
- Test: `tests/smoke.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `npm test` runs Vitest; `npm run validate` and `npm run build:icons` exist as scripts (implemented in Task 3 and 8).

- [ ] **Step 1: Confirm the two stylesheets are genuinely unreferenced**

Run: `grep -rn "master_styles" . --include=*.html --include=*.js --include=*.css`
Expected: no matches outside the filenames themselves. If any match appears, STOP and report — the deletion assumption is wrong.

- [ ] **Step 2: Delete the dead stylesheets**

```bash
git rm master_styles.css master_styles_utf8.css
```

- [ ] **Step 3: Add build artifacts and tooling to `.assetsignore`**

Append to `.assetsignore`:

```
docs
docs/**
tests
tests/**
icons/src
icons/src/**
vitest.config.js
data/dishes.schema.json
```

Rationale: `data/dishes.json` and `icons/sprite.svg` are fetched at runtime and must NOT be ignored. Only the sources and tooling are excluded.

- [ ] **Step 4: Install Vitest as a dev dependency**

```bash
npm install --save-dev vitest@^3
```

- [ ] **Step 5: Add scripts to `package.json`**

```json
{
  "name": "weekly-food-menu",
  "version": "3.0.0",
  "description": "A weekly meal planner application",
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "validate": "node scripts/validate.js",
    "build:icons": "node scripts/build-sprite.js",
    "release": "node scripts/release.js",
    "deploy": "npm run build:icons && npm run validate && npm test && npx wrangler pages deploy . --project-name=lunch-menu"
  },
  "author": "Antigravity",
  "license": "ISC"
}
```

Note `deploy` now gates on icons building, the manifest validating, and tests passing.

- [ ] **Step 6: Create `vitest.config.js`**

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
});
```

- [ ] **Step 7: Write a smoke test proving the harness runs**

`tests/smoke.test.js`:

```js
import { describe, it, expect } from 'vitest';

describe('test harness', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 8: Run the test suite**

Run: `npm test`
Expected: PASS, 1 test.

- [ ] **Step 9: Bump `js/version.js` to match `package.json`**

```js
export const APP_VERSION = '3.0.0';
```

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: remove 79KB dead CSS, add vitest harness, bump to 3.0.0"
```

---

## Task 2: ISO week keys

**Files:**
- Create: `js/core/week.js`
- Test: `tests/week.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `mondayOf(date: Date) => Date` — midnight on that week's Monday
  - `weekKey(date: Date) => string` — `"YYYY-MM-DD"` of that week's Monday
  - `weeksBetween(aKey: string, bKey: string) => number` — whole weeks from a to b, negative if b precedes a
  - `DAYS: string[]` — `['monday',...,'sunday']`

- [ ] **Step 1: Write the failing tests**

`tests/week.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { mondayOf, weekKey, weeksBetween, DAYS } from '../js/core/week.js';

describe('mondayOf', () => {
  it('returns the same day for a Monday', () => {
    expect(weekKey(new Date('2026-07-27T12:00:00'))).toBe('2026-07-27');
  });

  it('walks back to Monday from mid-week', () => {
    expect(weekKey(new Date('2026-07-30T23:59:00'))).toBe('2026-07-27');
  });

  it('treats Sunday as belonging to the week that started six days earlier', () => {
    expect(weekKey(new Date('2026-08-02T09:00:00'))).toBe('2026-07-27');
  });

  it('crosses a month boundary', () => {
    expect(weekKey(new Date('2026-08-01T09:00:00'))).toBe('2026-07-27');
  });

  it('zeroes the time component', () => {
    const m = mondayOf(new Date('2026-07-30T23:59:00'));
    expect(m.getHours()).toBe(0);
    expect(m.getMinutes()).toBe(0);
  });
});

describe('weeksBetween', () => {
  it('counts forward', () => {
    expect(weeksBetween('2026-07-06', '2026-07-27')).toBe(3);
  });

  it('is zero for the same week', () => {
    expect(weeksBetween('2026-07-27', '2026-07-27')).toBe(0);
  });

  it('is negative when the second key precedes the first', () => {
    expect(weeksBetween('2026-07-27', '2026-07-06')).toBe(-3);
  });

  it('is unaffected by a DST shift', () => {
    expect(weeksBetween('2026-03-02', '2026-03-30')).toBe(4);
  });
});

describe('DAYS', () => {
  it('starts on Monday and has seven entries', () => {
    expect(DAYS).toHaveLength(7);
    expect(DAYS[0]).toBe('monday');
    expect(DAYS[6]).toBe('sunday');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/week.test.js`
Expected: FAIL — cannot resolve `../js/core/week.js`.

- [ ] **Step 3: Implement `js/core/week.js`**

```js
export const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

/** Midnight on the Monday of the week containing `date`. */
export function mondayOf(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay();                    // 0=Sun .. 6=Sat
  const shift = dow === 0 ? -6 : 1 - dow;    // Sunday belongs to the week that began 6 days ago
  d.setDate(d.getDate() + shift);
  return d;
}

/** "YYYY-MM-DD" for the Monday of the week containing `date`. */
export function weekKey(date = new Date()) {
  const m = mondayOf(date);
  const yyyy = m.getFullYear();
  const mm = String(m.getMonth() + 1).padStart(2, '0');
  const dd = String(m.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Whole weeks from `aKey` to `bKey`. Both are Monday keys.
 * Uses UTC parsing so a daylight-saving transition inside the range
 * cannot round the division to the wrong integer.
 */
export function weeksBetween(aKey, bKey) {
  const a = Date.parse(`${aKey}T00:00:00Z`);
  const b = Date.parse(`${bKey}T00:00:00Z`);
  return Math.round((b - a) / (7 * 24 * 60 * 60 * 1000));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/week.test.js`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add js/core/week.js tests/week.test.js
git commit -m "feat: ISO-Monday week keys for history anchoring"
```

---

## Task 3: Dish manifest loader, schema, and validator

**Files:**
- Create: `js/domain/dishes.js`
- Create: `data/dishes.schema.json`
- Create: `scripts/validate.js`
- Test: `tests/dishes.test.js`
- Read only, never write: `data/dishes.json`

**Interfaces:**
- Consumes: `data/dishes.json` (already exists, under concurrent human edit).
- Produces:
  - `indexDishes(manifest) => { byId: Map, all: Dish[], forMeal(meal): Dish[], byCategory(meal, category): Dish[], proteinCategories: string[] }`
  - `loadDishes(fetchFn?) => Promise<Index>` — fetches `data/dishes.json` in the browser
  - `FALLBACK_ICON = '_fallback'`

A `Dish` is `{ id, name, meals, category, prep, icon, description }`.

- [ ] **Step 1: Write the failing tests**

`tests/dishes.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { indexDishes, FALLBACK_ICON } from '../js/domain/dishes.js';

const manifest = JSON.parse(readFileSync(new URL('../data/dishes.json', import.meta.url), 'utf8'));

describe('manifest integrity', () => {
  it('has unique ids', () => {
    const ids = manifest.dishes.map(d => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every dish at least one meal', () => {
    for (const d of manifest.dishes) {
      expect(d.meals.length, `${d.id} has no meals`).toBeGreaterThan(0);
    }
  });

  it('declares every dish category in the category list for its meal', () => {
    for (const d of manifest.dishes) {
      for (const meal of d.meals) {
        expect(manifest.categories[meal], `unknown meal ${meal} on ${d.id}`).toBeDefined();
        expect(manifest.categories[meal], `${d.id}: ${d.category} not valid for ${meal}`)
          .toContain(d.category);
      }
    }
  });

  it('gives every dish a non-empty prep', () => {
    for (const d of manifest.dishes) {
      expect(d.prep, `${d.id} has no prep`).toBeTruthy();
    }
  });
});

describe('indexDishes', () => {
  const idx = indexDishes(manifest);

  it('looks dishes up by id', () => {
    expect(idx.byId.get('kai-lan').category).toBe('vegetables');
  });

  it('partitions by meal', () => {
    const lunch = idx.forMeal('lunch');
    expect(lunch.every(d => d.meals.includes('lunch'))).toBe(true);
    expect(lunch.some(d => d.id === 'rice')).toBe(false);
  });

  it('filters by category within a meal', () => {
    const veg = idx.byCategory('dinner', 'vegetables');
    expect(veg.length).toBeGreaterThanOrEqual(7);
    expect(veg.every(d => d.category === 'vegetables')).toBe(true);
  });

  it('exposes the protein categories from the manifest', () => {
    expect(idx.proteinCategories).toContain('fish');
    expect(idx.proteinCategories).not.toContain('vegetables');
  });
});

describe('generation feasibility', () => {
  const idx = indexDishes(manifest);

  it('has at least 7 vegetables so a week never repeats one', () => {
    expect(idx.byCategory('dinner', 'vegetables').length).toBeGreaterThanOrEqual(7);
  });

  it('has at least 7 lunch mains', () => {
    expect(idx.forMeal('lunch').length).toBeGreaterThanOrEqual(7);
  });

  it('has enough proteins across categories to fill a week under the per-category cap of 2', () => {
    const total = idx.proteinCategories
      .reduce((n, c) => n + Math.min(idx.byCategory('dinner', c).length, 2), 0);
    expect(total).toBeGreaterThanOrEqual(7);
  });

  it('has at least one rice dish for dinner', () => {
    expect(idx.byCategory('dinner', 'rice').length).toBeGreaterThanOrEqual(1);
  });

  it('exposes FALLBACK_ICON', () => {
    expect(FALLBACK_ICON).toBe('_fallback');
  });
});
```

These feasibility tests are the guard rail on concurrent manifest editing: if a human edit drops the vegetable pool below 7, the suite fails loudly rather than the generator silently repeating dishes.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/dishes.test.js`
Expected: FAIL — cannot resolve `../js/domain/dishes.js`.

- [ ] **Step 3: Implement `js/domain/dishes.js`**

```js
export const FALLBACK_ICON = '_fallback';

/**
 * Build lookup structures over a parsed dishes.json manifest.
 * Pure — takes the manifest object, does no I/O.
 */
export function indexDishes(manifest) {
  const all = manifest.dishes;
  const byId = new Map(all.map(d => [d.id, d]));

  const forMeal = (meal) => all.filter(d => d.meals.includes(meal));
  const byCategory = (meal, category) =>
    forMeal(meal).filter(d => d.category === category);

  return {
    all,
    byId,
    forMeal,
    byCategory,
    categories: manifest.categories,
    proteinCategories: manifest.proteinCategories,
  };
}

/** Fetch and index the manifest. Browser entry point. */
export async function loadDishes(fetchFn = fetch) {
  const res = await fetchFn('data/dishes.json');
  if (!res.ok) throw new Error(`Failed to load dishes.json: ${res.status}`);
  return indexDishes(await res.json());
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/dishes.test.js`
Expected: PASS, 14 tests.

- [ ] **Step 5: Create `data/dishes.schema.json`**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Weekly Meals dish manifest",
  "type": "object",
  "required": ["version", "categories", "proteinCategories", "dishes"],
  "properties": {
    "version": { "type": "integer" },
    "categories": {
      "type": "object",
      "required": ["lunch", "dinner"],
      "additionalProperties": { "type": "array", "items": { "type": "string" } }
    },
    "proteinCategories": { "type": "array", "items": { "type": "string" } },
    "dishes": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "name", "meals", "category", "prep", "icon"],
        "properties": {
          "id":       { "type": "string", "pattern": "^[a-z0-9-]+$" },
          "name":     { "type": "string", "minLength": 1 },
          "meals":    { "type": "array", "minItems": 1,
                        "items": { "enum": ["lunch", "dinner"] } },
          "category": { "type": "string" },
          "prep":     { "type": "string", "minLength": 1 },
          "icon":     { "type": "string", "pattern": "^[a-z0-9_-]+$" },
          "description": { "type": "string" }
        },
        "additionalProperties": false
      }
    }
  }
}
```

- [ ] **Step 6: Implement `scripts/validate.js`**

```js
#!/usr/bin/env node
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(root, 'data/dishes.json'), 'utf8'));

const errors = [];
const warnings = [];

// Unique ids
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
```

- [ ] **Step 7: Run the validator**

Run: `npm run validate`
Expected: exit 0. Warnings about empty descriptions and the missing sprite are expected at this stage — those are Phase 2 and Task 8 respectively. Any `ERROR` line means the manifest is broken; report it rather than editing `dishes.json`.

- [ ] **Step 8: Commit**

```bash
git add js/domain/dishes.js data/dishes.schema.json scripts/validate.js tests/dishes.test.js
git commit -m "feat: dish manifest loader, schema, and validator"
```

---

## Task 4: Plan shape accessors and history index

**Files:**
- Create: `js/core/plan.js`
- Create: `js/core/history.js`
- Test: `tests/plan.test.js`
- Test: `tests/history.test.js`

**Interfaces:**
- Consumes: `weeksBetween`, `DAYS` from `js/core/week.js`.
- Produces from `plan.js`:
  - `MAX_WEEKS = 13` — current week plus 12 of history
  - `emptyWeek(weekOf) => Week` — `{ weekOf, lunch: [[],…7], dinner: [[],…7] }`
  - `dayIndex(dayName) => 0..6`
  - `slotOf(week, meal, dayIdx) => Placement[]`
  - `idsIn(week) => Set<string>`
  - `isEmpty(week) => boolean`
  - `addPlacement(week, meal, dayIdx, dishId)` — mutates a draft, no-op if already present
  - `removePlacement(week, meal, dayIdx, dishId)`
  - `toggleLockAt(week, meal, dayIdx, dishId) => boolean`
  - `isLockedAt(week, meal, dayIdx, dishId) => boolean`
  - `lockedPlacements(week, meal) => Placement[][]` — 7 arrays, locked entries only
  - `clearMealKeepingLocks(week, meal)`
- Produces from `history.js`:
  - `historyOf(state) => Week[]` — `state.weeks.slice(1)`
  - `buildLastUsedIndex(weeks) => Map<dishId, weekOf>`
  - `weeksSince(index, dishId, currentWeekKey) => number` — `Infinity` if absent
  - `rollTo(state, nextWeekKey) => State` — unshift a fresh week, trim to `MAX_WEEKS`
  - `findWeek(state, weekOf) => Week | null`

A `Placement` is `{ id: string }`, or `{ id: string, lock: true }` when pinned.
A `Week` is `{ weekOf: string, lunch: Placement[][], dinner: Placement[][] }` with both arrays exactly 7 long, index 0 = Monday.

- [ ] **Step 1: Write the failing tests**

`tests/plan.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  MAX_WEEKS, emptyWeek, dayIndex, slotOf, idsIn, isEmpty,
  addPlacement, removePlacement, toggleLockAt, isLockedAt,
  lockedPlacements, clearMealKeepingLocks,
} from '../js/core/plan.js';

describe('emptyWeek', () => {
  it('creates exactly seven slots per meal', () => {
    const w = emptyWeek('2026-07-27');
    expect(w.lunch).toHaveLength(7);
    expect(w.dinner).toHaveLength(7);
  });

  it('starts every slot empty and independent', () => {
    const w = emptyWeek('2026-07-27');
    w.lunch[0].push({ id: 'bee-hoon' });
    expect(w.lunch[1]).toHaveLength(0);
  });

  it('records the week key', () => {
    expect(emptyWeek('2026-07-27').weekOf).toBe('2026-07-27');
  });
});

describe('dayIndex', () => {
  it('maps Monday to 0 and Sunday to 6', () => {
    expect(dayIndex('monday')).toBe(0);
    expect(dayIndex('sunday')).toBe(6);
  });
});

describe('placements', () => {
  it('adds a dish', () => {
    const w = emptyWeek('2026-07-27');
    addPlacement(w, 'lunch', 0, 'bee-hoon');
    expect(slotOf(w, 'lunch', 0)).toEqual([{ id: 'bee-hoon' }]);
  });

  it('does not add the same dish twice to one slot', () => {
    const w = emptyWeek('2026-07-27');
    addPlacement(w, 'lunch', 0, 'bee-hoon');
    addPlacement(w, 'lunch', 0, 'bee-hoon');
    expect(slotOf(w, 'lunch', 0)).toHaveLength(1);
  });

  it('removes a dish', () => {
    const w = emptyWeek('2026-07-27');
    addPlacement(w, 'dinner', 2, 'rice');
    addPlacement(w, 'dinner', 2, 'kai-lan');
    removePlacement(w, 'dinner', 2, 'rice');
    expect(slotOf(w, 'dinner', 2)).toEqual([{ id: 'kai-lan' }]);
  });

  it('takes the lock with the placement when removed', () => {
    const w = emptyWeek('2026-07-27');
    addPlacement(w, 'lunch', 0, 'bee-hoon');
    toggleLockAt(w, 'lunch', 0, 'bee-hoon');
    removePlacement(w, 'lunch', 0, 'bee-hoon');
    expect(isLockedAt(w, 'lunch', 0, 'bee-hoon')).toBe(false);
  });
});

describe('locks', () => {
  it('toggles on and off', () => {
    const w = emptyWeek('2026-07-27');
    addPlacement(w, 'lunch', 0, 'bee-hoon');
    expect(toggleLockAt(w, 'lunch', 0, 'bee-hoon')).toBe(true);
    expect(isLockedAt(w, 'lunch', 0, 'bee-hoon')).toBe(true);
    expect(toggleLockAt(w, 'lunch', 0, 'bee-hoon')).toBe(false);
    expect(isLockedAt(w, 'lunch', 0, 'bee-hoon')).toBe(false);
  });

  it('is a no-op for a dish that is not placed', () => {
    const w = emptyWeek('2026-07-27');
    expect(toggleLockAt(w, 'lunch', 0, 'ghost')).toBe(false);
  });

  it('collects locked placements as seven slot arrays', () => {
    const w = emptyWeek('2026-07-27');
    addPlacement(w, 'dinner', 3, 'curry-chicken');
    addPlacement(w, 'dinner', 3, 'rice');
    toggleLockAt(w, 'dinner', 3, 'curry-chicken');
    const locked = lockedPlacements(w, 'dinner');
    expect(locked).toHaveLength(7);
    expect(locked[3]).toEqual([{ id: 'curry-chicken', lock: true }]);
    expect(locked[0]).toEqual([]);
  });
});

describe('clearMealKeepingLocks', () => {
  it('drops unlocked placements and keeps locked ones', () => {
    const w = emptyWeek('2026-07-27');
    addPlacement(w, 'lunch', 0, 'bee-hoon');
    addPlacement(w, 'lunch', 1, 'porridge');
    toggleLockAt(w, 'lunch', 1, 'porridge');
    clearMealKeepingLocks(w, 'lunch');
    expect(slotOf(w, 'lunch', 0)).toEqual([]);
    expect(slotOf(w, 'lunch', 1)).toEqual([{ id: 'porridge', lock: true }]);
  });

  it('leaves the other meal untouched', () => {
    const w = emptyWeek('2026-07-27');
    addPlacement(w, 'dinner', 0, 'rice');
    clearMealKeepingLocks(w, 'lunch');
    expect(slotOf(w, 'dinner', 0)).toEqual([{ id: 'rice' }]);
  });
});

describe('idsIn and isEmpty', () => {
  it('collects every id across both meals', () => {
    const w = emptyWeek('2026-07-27');
    addPlacement(w, 'lunch', 0, 'bee-hoon');
    addPlacement(w, 'dinner', 4, 'rice');
    expect(idsIn(w)).toEqual(new Set(['bee-hoon', 'rice']));
  });

  it('reports an untouched week as empty', () => {
    expect(isEmpty(emptyWeek('2026-07-27'))).toBe(true);
  });

  it('reports a week with any placement as not empty', () => {
    const w = emptyWeek('2026-07-27');
    addPlacement(w, 'lunch', 6, 'porridge');
    expect(isEmpty(w)).toBe(false);
  });
});

describe('MAX_WEEKS', () => {
  it('allows the current week plus twelve of history', () => {
    expect(MAX_WEEKS).toBe(13);
  });
});
```

`tests/history.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { emptyWeek, addPlacement, MAX_WEEKS } from '../js/core/plan.js';
import { historyOf, buildLastUsedIndex, weeksSince, rollTo, findWeek } from '../js/core/history.js';

const weekWith = (weekOf, lunchMon = [], dinnerMon = []) => {
  const w = emptyWeek(weekOf);
  for (const id of lunchMon) addPlacement(w, 'lunch', 0, id);
  for (const id of dinnerMon) addPlacement(w, 'dinner', 0, id);
  return w;
};

const stateWith = (...weeks) => ({ version: 3, weeks, custom: [], recipes: {} });

describe('historyOf', () => {
  it('excludes the current week', () => {
    const s = stateWith(weekWith('2026-07-27'), weekWith('2026-07-20'));
    expect(historyOf(s).map(w => w.weekOf)).toEqual(['2026-07-20']);
  });

  it('is empty when only the current week exists', () => {
    expect(historyOf(stateWith(weekWith('2026-07-27')))).toEqual([]);
  });
});

describe('buildLastUsedIndex', () => {
  it('records the most recent week for each dish', () => {
    const idx = buildLastUsedIndex([weekWith('2026-07-20', ['bee-hoon']), weekWith('2026-07-06', ['porridge'])]);
    expect(idx.get('bee-hoon')).toBe('2026-07-20');
    expect(idx.get('porridge')).toBe('2026-07-06');
  });

  it('keeps the newest when a dish appears in several weeks', () => {
    const idx = buildLastUsedIndex([weekWith('2026-07-20', ['porridge']), weekWith('2026-07-06', ['porridge'])]);
    expect(idx.get('porridge')).toBe('2026-07-20');
  });

  it('covers both meals', () => {
    const idx = buildLastUsedIndex([weekWith('2026-07-20', ['bee-hoon'], ['rice'])]);
    expect(idx.get('rice')).toBe('2026-07-20');
  });

  it('omits dishes never used', () => {
    expect(buildLastUsedIndex([weekWith('2026-07-20')]).has('fried-rice')).toBe(false);
  });
});

describe('weeksSince', () => {
  const idx = buildLastUsedIndex([weekWith('2026-07-20', ['bee-hoon']), weekWith('2026-07-06', ['porridge'])]);

  it('returns Infinity for a dish never used', () => {
    expect(weeksSince(idx, 'fried-rice', '2026-07-27')).toBe(Infinity);
  });

  it('measures one week back', () => {
    expect(weeksSince(idx, 'bee-hoon', '2026-07-27')).toBe(1);
  });

  it('measures three weeks back', () => {
    expect(weeksSince(idx, 'porridge', '2026-07-27')).toBe(3);
  });
});

describe('rollTo', () => {
  it('puts a fresh empty week at the front', () => {
    const next = rollTo(stateWith(weekWith('2026-07-27', ['bee-hoon'])), '2026-08-03');
    expect(next.weeks[0].weekOf).toBe('2026-08-03');
    expect(next.weeks[0].lunch[0]).toEqual([]);
  });

  it('pushes the old current week into history intact', () => {
    const next = rollTo(stateWith(weekWith('2026-07-27', ['bee-hoon'])), '2026-08-03');
    expect(next.weeks[1].weekOf).toBe('2026-07-27');
    expect(next.weeks[1].lunch[0]).toEqual([{ id: 'bee-hoon' }]);
  });

  it('discards an empty current week rather than archiving it', () => {
    const next = rollTo(stateWith(weekWith('2026-07-27')), '2026-08-03');
    expect(next.weeks).toHaveLength(1);
  });

  it('trims to MAX_WEEKS', () => {
    let s = stateWith(weekWith('2026-01-05', ['bee-hoon']));
    for (let i = 1; i < 30; i++) {
      s = rollTo(s, `2026-W${i}`);
      s.weeks[0].lunch[0].push({ id: 'bee-hoon' });   // keep each week non-empty
    }
    expect(s.weeks.length).toBeLessThanOrEqual(MAX_WEEKS);
  });

  it('does not mutate the input state', () => {
    const s = stateWith(weekWith('2026-07-27', ['bee-hoon']));
    rollTo(s, '2026-08-03');
    expect(s.weeks).toHaveLength(1);
  });
});

describe('findWeek', () => {
  it('finds a week by key', () => {
    const s = stateWith(weekWith('2026-07-27'), weekWith('2026-07-20'));
    expect(findWeek(s, '2026-07-20').weekOf).toBe('2026-07-20');
  });

  it('returns null when absent', () => {
    expect(findWeek(stateWith(weekWith('2026-07-27')), '2026-01-05')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/plan.test.js tests/history.test.js`
Expected: FAIL — cannot resolve `../js/core/plan.js`.

- [ ] **Step 3: Implement `js/core/plan.js`**

```js
import { DAYS } from './week.js';

/** Current week plus twelve of history. */
export const MAX_WEEKS = 13;

const MEALS = ['lunch', 'dinner'];

export function emptyWeek(weekOf) {
  return {
    weekOf,
    lunch:  Array.from({ length: 7 }, () => []),
    dinner: Array.from({ length: 7 }, () => []),
  };
}

export function dayIndex(dayName) {
  return DAYS.indexOf(dayName);
}

export function slotOf(week, meal, dayIdx) {
  return week[meal][dayIdx];
}

export function idsIn(week) {
  const ids = new Set();
  for (const meal of MEALS) {
    for (const slot of week[meal]) {
      for (const p of slot) ids.add(p.id);
    }
  }
  return ids;
}

export function isEmpty(week) {
  return MEALS.every(meal => week[meal].every(slot => slot.length === 0));
}

/** Mutates `week`. No-op when the dish is already in that slot. */
export function addPlacement(week, meal, dayIdx, dishId) {
  const slot = week[meal][dayIdx];
  if (!slot.some(p => p.id === dishId)) slot.push({ id: dishId });
}

/** Mutates `week`. The lock, living on the placement, goes with it. */
export function removePlacement(week, meal, dayIdx, dishId) {
  week[meal][dayIdx] = week[meal][dayIdx].filter(p => p.id !== dishId);
}

/** Mutates `week`. Returns the resulting lock state; false if not placed. */
export function toggleLockAt(week, meal, dayIdx, dishId) {
  const p = week[meal][dayIdx].find(x => x.id === dishId);
  if (!p) return false;
  if (p.lock) { delete p.lock; return false; }
  p.lock = true;
  return true;
}

export function isLockedAt(week, meal, dayIdx, dishId) {
  return Boolean(week[meal][dayIdx].find(p => p.id === dishId)?.lock);
}

/** Seven slot arrays containing only the locked placements. */
export function lockedPlacements(week, meal) {
  return week[meal].map(slot => slot.filter(p => p.lock));
}

/**
 * Mutates `week`. Drops unlocked placements and keeps pinned ones —
 * "clear everything except what I pinned".
 */
export function clearMealKeepingLocks(week, meal) {
  week[meal] = week[meal].map(slot => slot.filter(p => p.lock));
}
```

- [ ] **Step 4: Implement `js/core/history.js`**

```js
import { weeksBetween } from './week.js';
import { MAX_WEEKS, emptyWeek, isEmpty } from './plan.js';

const MEALS = ['lunch', 'dinner'];

/** Past weeks only — weeks[0] is the week currently being planned. */
export function historyOf(state) {
  return state.weeks.slice(1);
}

/**
 * Map of dish id -> the most recent weekOf in which it appeared.
 *
 * `weeks` must be newest-first, which lets a single pass win: the first
 * time an id is seen is by construction its most recent use, so no date
 * comparison is needed. Built once per generate run, then queried O(1) —
 * the naive alternative rescans every history week per candidate per slot.
 */
export function buildLastUsedIndex(weeks) {
  const index = new Map();
  for (const week of weeks) {
    for (const meal of MEALS) {
      for (const slot of week[meal]) {
        for (const p of slot) {
          if (!index.has(p.id)) index.set(p.id, week.weekOf);
        }
      }
    }
  }
  return index;
}

export function weeksSince(index, dishId, currentWeekKey) {
  const last = index.get(dishId);
  if (last === undefined) return Infinity;
  return weeksBetween(last, currentWeekKey);
}

/**
 * Start a new current week. The outgoing week is archived unless it is
 * empty, in which case it is discarded rather than cluttering history.
 * Returns new state; does not mutate.
 */
export function rollTo(state, nextWeekKey) {
  const outgoing = state.weeks[0];
  const kept = outgoing && !isEmpty(outgoing) ? state.weeks : state.weeks.slice(1);
  return { ...state, weeks: [emptyWeek(nextWeekKey), ...kept].slice(0, MAX_WEEKS) };
}

export function findWeek(state, weekOf) {
  return state.weeks.find(w => w.weekOf === weekOf) ?? null;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/plan.test.js tests/history.test.js`
Expected: PASS — 18 plan tests, 15 history tests.

- [ ] **Step 6: Commit**

```bash
git add js/core/plan.js js/core/history.js tests/plan.test.js tests/history.test.js
git commit -m "feat: flat week/placement model with O(1) last-used index"
```

---

## Task 5: Generator — weighted LRU with category and prep rotation

**Files:**
- Create: `js/domain/generator.js`
- Test: `tests/generator.test.js`

**Interfaces:**
- Consumes: `indexDishes` output from `js/domain/dishes.js`; `buildLastUsedIndex`, `weeksSince` from `js/core/history.js`; `emptyWeek`, `lockedPlacements` from `js/core/plan.js`.
- Produces:
  - `generateWeek({ index, history, weekKey, base, rng }) => Week`
  - `RECENCY_CAP`, `PROTEIN_CAP`, `FRIED_CAP`, `LUNCH_SOUP_CAP`, `SOUP_PROBABILITY`
  - `weightedPick(items, weights, rng) => item`

`history` is past weeks, newest first. `base` is the week whose locked placements must be preserved (optional — omit for a clean generate). The return value is a complete `Week` in the shape defined by `plan.js`.

- [ ] **Step 1: Write the failing tests**

`tests/generator.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { indexDishes } from '../js/domain/dishes.js';
import { emptyWeek } from '../js/core/plan.js';
import {
  generateWeek, weightedPick, PROTEIN_CAP, FRIED_CAP,
} from '../js/domain/generator.js';

const manifest = JSON.parse(readFileSync(new URL('../data/dishes.json', import.meta.url), 'utf8'));
const index = indexDishes(manifest);

/** Deterministic PRNG so every assertion below is reproducible. */
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const gen = (seed, history = []) =>
  generateWeek({ index, history, weekKey: '2026-07-27', rng: mulberry32(seed) });

const catOf = (id) => index.byId.get(id).category;
const prepOf = (id) => index.byId.get(id).prep;

/** Dish ids in one slot, and across a whole meal. */
const slot = (week, meal, day) => week[meal][day].map(p => p.id);
const allOf = (week, meal) => week[meal].flat().map(p => p.id);
const D = [0, 1, 2, 3, 4, 5, 6];

describe('weightedPick', () => {
  it('always returns the only candidate', () => {
    expect(weightedPick(['a'], [1], () => 0.99)).toBe('a');
  });

  it('picks the first item when rng is 0', () => {
    expect(weightedPick(['a', 'b'], [1, 1], () => 0)).toBe('a');
  });

  it('never returns a zero-weight item when a positive-weight one exists', () => {
    for (let i = 0; i < 50; i++) {
      expect(weightedPick(['a', 'b'], [0, 1], mulberry32(i))).toBe('b');
    }
  });
});

describe('week shape', () => {
  it('returns a well-formed Week', () => {
    const w = gen(1);
    expect(w.weekOf).toBe('2026-07-27');
    expect(w.lunch).toHaveLength(7);
    expect(w.dinner).toHaveLength(7);
  });

  it('fills all seven days for both meals', () => {
    const w = gen(1);
    for (const day of D) {
      expect(slot(w, 'lunch', day), `lunch ${day}`).toHaveLength(1);
      expect(slot(w, 'dinner', day).length, `dinner ${day}`).toBeGreaterThanOrEqual(3);
      expect(slot(w, 'dinner', day).length, `dinner ${day}`).toBeLessThanOrEqual(4);
    }
  });

  it('stores placements as objects, not bare ids', () => {
    expect(gen(1).lunch[0][0]).toHaveProperty('id');
  });

  it('gives every dinner exactly one rice, one vegetable, and one protein', () => {
    const w = gen(2);
    for (const day of D) {
      const cats = slot(w, 'dinner', day).map(catOf);
      expect(cats.filter(c => c === 'rice')).toHaveLength(1);
      expect(cats.filter(c => c === 'vegetables')).toHaveLength(1);
      expect(cats.filter(c => index.proteinCategories.includes(c))).toHaveLength(1);
      expect(cats.filter(c => c === 'soup').length).toBeLessThanOrEqual(1);
    }
  });

  it('only ever serves lunch dishes at lunch and dinner dishes at dinner', () => {
    const w = gen(3);
    for (const id of allOf(w, 'lunch'))  expect(index.byId.get(id).meals).toContain('lunch');
    for (const id of allOf(w, 'dinner')) expect(index.byId.get(id).meals).toContain('dinner');
  });
});

describe('within-week no-repeat guarantee', () => {
  it('never repeats a lunch main across 200 seeds', () => {
    for (let s = 0; s < 200; s++) {
      const ids = allOf(gen(s), 'lunch');
      expect(new Set(ids).size, `seed ${s}`).toBe(ids.length);
    }
  });

  it('never repeats a vegetable across 200 seeds', () => {
    for (let s = 0; s < 200; s++) {
      const veg = allOf(gen(s), 'dinner').filter(id => catOf(id) === 'vegetables');
      expect(new Set(veg).size, `seed ${s}`).toBe(veg.length);
    }
  });

  it('never repeats a protein across 200 seeds', () => {
    for (let s = 0; s < 200; s++) {
      const p = allOf(gen(s), 'dinner').filter(id => index.proteinCategories.includes(catOf(id)));
      expect(new Set(p).size, `seed ${s}`).toBe(p.length);
    }
  });

  it('does repeat rice, which is the intentional exception', () => {
    const rice = allOf(gen(1), 'dinner').filter(id => catOf(id) === 'rice');
    expect(rice).toHaveLength(7);
  });
});

describe('rotation caps', () => {
  it('serves no protein category more than PROTEIN_CAP nights', () => {
    for (let s = 0; s < 100; s++) {
      const counts = {};
      for (const id of allOf(gen(s), 'dinner')) {
        const c = catOf(id);
        if (index.proteinCategories.includes(c)) counts[c] = (counts[c] ?? 0) + 1;
      }
      for (const [cat, n] of Object.entries(counts)) {
        expect(n, `seed ${s}: ${cat}`).toBeLessThanOrEqual(PROTEIN_CAP);
      }
    }
  });

  it('serves no more than FRIED_CAP fried dinners', () => {
    for (let s = 0; s < 100; s++) {
      const fried = allOf(gen(s), 'dinner').filter(id => prepOf(id) === 'fried');
      expect(fried.length, `seed ${s}`).toBeLessThanOrEqual(FRIED_CAP);
    }
  });
});

describe('history awareness', () => {
  it('avoids dishes used last week when alternatives exist', () => {
    const lastWeek = gen(7);
    const history = [{ ...lastWeek, weekOf: '2026-07-20' }];
    const lastLunch = new Set(allOf(lastWeek, 'lunch'));

    let withHistory = 0;
    let without = 0;
    for (let s = 100; s < 140; s++) {
      withHistory += allOf(generateWeek({ index, history, weekKey: '2026-07-27', rng: mulberry32(s) }), 'lunch')
        .filter(id => lastLunch.has(id)).length;
      without += allOf(generateWeek({ index, history: [], weekKey: '2026-07-27', rng: mulberry32(s) }), 'lunch')
        .filter(id => lastLunch.has(id)).length;
    }
    expect(withHistory).toBeLessThan(without);
  });

  it('builds the last-used index once rather than rescanning per candidate', () => {
    // A 12-week history must not measurably change the cost of one generate.
    const history = Array.from({ length: 12 }, (_, i) => ({ ...gen(i), weekOf: `2026-0${1 + (i % 9)}-05` }));
    const start = performance.now();
    for (let s = 0; s < 50; s++) generateWeek({ index, history, weekKey: '2026-10-05', rng: mulberry32(s) });
    expect(performance.now() - start).toBeLessThan(1000);
  });
});

describe('locks', () => {
  const baseWith = (meal, day, id) => {
    const w = emptyWeek('2026-07-27');
    w[meal][day].push({ id, lock: true });
    return w;
  };

  it('preserves a locked lunch dish', () => {
    const w = generateWeek({ index, history: [], weekKey: '2026-07-27', base: baseWith('lunch', 2, 'porridge'), rng: mulberry32(11) });
    expect(slot(w, 'lunch', 2)).toContain('porridge');
  });

  it('keeps the lock flag on the carried-over placement', () => {
    const w = generateWeek({ index, history: [], weekKey: '2026-07-27', base: baseWith('lunch', 2, 'porridge'), rng: mulberry32(11) });
    expect(w.lunch[2][0].lock).toBe(true);
  });

  it('does not serve a locked dish again elsewhere in the week', () => {
    for (let s = 0; s < 50; s++) {
      const w = generateWeek({ index, history: [], weekKey: '2026-07-27', base: baseWith('lunch', 2, 'porridge'), rng: mulberry32(s) });
      const elsewhere = D.filter(d => d !== 2).flatMap(d => slot(w, 'lunch', d));
      expect(elsewhere, `seed ${s}`).not.toContain('porridge');
    }
  });

  it('drops unlocked placements from the base', () => {
    const base = emptyWeek('2026-07-27');
    base.lunch[0].push({ id: 'porridge' });          // not locked
    const w = generateWeek({ index, history: [], weekKey: '2026-07-27', base, rng: mulberry32(3) });
    expect(allOf(w, 'lunch').filter(id => id === 'porridge').length).toBeLessThanOrEqual(1);
  });

  it('preserves a locked dinner protein and still completes the composition', () => {
    const w = generateWeek({ index, history: [], weekKey: '2026-07-27', base: baseWith('dinner', 4, 'curry-chicken'), rng: mulberry32(13) });
    expect(slot(w, 'dinner', 4)).toContain('curry-chicken');
    const cats = slot(w, 'dinner', 4).map(catOf);
    expect(cats.filter(c => c === 'rice')).toHaveLength(1);
    expect(cats.filter(c => c === 'vegetables')).toHaveLength(1);
    expect(cats.filter(c => index.proteinCategories.includes(c))).toHaveLength(1);
  });
});

describe('degradation', () => {
  it('still fills a week when the vegetable pool exactly meets demand', () => {
    const keep = manifest.dishes.filter(d => d.category === 'vegetables').slice(0, 7);
    const trimmed = indexDishes({
      ...manifest,
      dishes: manifest.dishes.filter(d => d.category !== 'vegetables' || keep.includes(d)),
    });
    const w = generateWeek({ index: trimmed, history: [], weekKey: '2026-07-27', rng: mulberry32(5) });
    for (const day of D) {
      const cats = w.dinner[day].map(p => trimmed.byId.get(p.id).category);
      expect(cats, `day ${day}`).toContain('vegetables');
    }
  });

  it('produces no undefined or malformed placements', () => {
    for (let s = 0; s < 100; s++) {
      const w = gen(s);
      for (const meal of ['lunch', 'dinner']) {
        for (const p of w[meal].flat()) {
          expect(p, `seed ${s}`).toBeTruthy();
          expect(typeof p.id, `seed ${s}`).toBe('string');
        }
      }
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/generator.test.js`
Expected: FAIL — cannot resolve `../js/domain/generator.js`.

- [ ] **Step 3: Implement `js/domain/generator.js`**

```js
import { buildLastUsedIndex, weeksSince } from '../core/history.js';
import { emptyWeek, lockedPlacements } from '../core/plan.js';

export const RECENCY_CAP = 8;        // weeks; beyond this, "long ago" stops mattering
export const PROTEIN_CAP = 2;        // nights per protein category per week
export const FRIED_CAP = 2;          // fried dinners per week
export const LUNCH_SOUP_CAP = 2;     // soup-prep lunches per week
export const SOUP_PROBABILITY = 0.4; // chance a dinner gains a soup

/** Sample one item proportionally to its weight. */
export function weightedPick(items, weights, rng = Math.random) {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return items[Math.floor(rng() * items.length)];
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

function recencyWeight(dish, lastUsed, weekKey) {
  const gap = weeksSince(lastUsed, dish.id, weekKey);
  const capped = gap === Infinity ? RECENCY_CAP : Math.min(gap, RECENCY_CAP);
  return Math.max(capped, 1) ** 2;
}

/** True when placing `dish` would exceed a weekly rotation cap. */
function violatesCap(dish, counters, index) {
  if (index.proteinCategories.includes(dish.category)
      && (counters.category[dish.category] ?? 0) >= PROTEIN_CAP) return true;
  if (dish.prep === 'fried' && (counters.prep.fried ?? 0) >= FRIED_CAP) return true;
  return false;
}

/**
 * Choose one dish from `pool`, excluding anything already used this week,
 * weighted by recency.
 *
 * Caps are HARD while they are satisfiable and relax only when honouring
 * them would leave no candidate at all. A soft weight penalty is wrong:
 * with a large pool, 2% of a large weight still wins occasionally, so a
 * third pork night slips through. Filter, then fall back — never merely
 * discourage.
 *
 * Returns null only when the pool is entirely exhausted.
 */
function choose({ pool, used, lastUsed, weekKey, counters, index, rng }) {
  const available = pool.filter(d => !used.has(d.id));
  if (available.length === 0) return null;

  const withinCaps = available.filter(d => !violatesCap(d, counters, index));
  const candidates = withinCaps.length ? withinCaps : available;

  const weights = candidates.map(d => recencyWeight(d, lastUsed, weekKey));
  return weightedPick(candidates, weights, rng);
}

function bump(counters, dish) {
  counters.category[dish.category] = (counters.category[dish.category] ?? 0) + 1;
  counters.prep[dish.prep] = (counters.prep[dish.prep] ?? 0) + 1;
}

/**
 * Build a complete week for both meals.
 *
 * The last-used index is built ONCE here and queried O(1) per candidate.
 * Rebuilding it per lookup would rescan every history week for every
 * candidate in every slot — the same answer for ~300x the work.
 *
 * Locked placements from `base` are carried over first and marked used, so
 * they are never duplicated elsewhere and they count toward rotation caps.
 */
export function generateWeek({ index, history = [], weekKey, base = null, rng = Math.random }) {
  const lastUsed = buildLastUsedIndex(history);
  const used = new Set();
  const counters = { category: {}, prep: {} };
  const week = emptyWeek(weekKey);

  // 1. Carry over locks so nothing else can collide with them.
  for (const meal of ['lunch', 'dinner']) {
    const locked = base ? lockedPlacements(base, meal) : Array.from({ length: 7 }, () => []);
    for (let day = 0; day < 7; day++) {
      week[meal][day] = locked[day].map(p => ({ ...p }));
      for (const p of locked[day]) {
        used.add(p.id);
        const dish = index.byId.get(p.id);
        if (dish) bump(counters, dish);
      }
    }
  }

  // 2. Lunch — one main per day.
  const lunchPool = index.forMeal('lunch');
  for (let day = 0; day < 7; day++) {
    if (week.lunch[day].length > 0) continue;   // locked
    const soupCapped = (counters.prep.soup ?? 0) >= LUNCH_SOUP_CAP;
    const narrowed = soupCapped ? lunchPool.filter(d => d.prep !== 'soup') : lunchPool;
    const pick = choose({ pool: narrowed.length ? narrowed : lunchPool, used, lastUsed, weekKey, counters, index, rng });
    if (!pick) continue;
    week.lunch[day].push({ id: pick.id });
    used.add(pick.id);
    bump(counters, pick);
  }

  // 3. Dinner — rice + vegetable + protein + optional soup.
  const rice = index.byCategory('dinner', 'rice');
  const veg = index.byCategory('dinner', 'vegetables');
  const proteins = index.proteinCategories.flatMap(c => index.byCategory('dinner', c));
  const soups = index.byCategory('dinner', 'soup');

  for (let day = 0; day < 7; day++) {
    const slot = week.dinner[day];
    const has = (pred) => slot.some(p => pred(index.byId.get(p.id)));
    const place = (pick) => { slot.push({ id: pick.id }); used.add(pick.id); bump(counters, pick); };

    // Rice is the nightly staple, not a variety choice — intentionally
    // exempt from the no-repeat rule and never added to `used`.
    if (!has(d => d?.category === 'rice') && rice.length) slot.push({ id: rice[0].id });

    if (!has(d => d?.category === 'vegetables')) {
      const pick = choose({ pool: veg, used, lastUsed, weekKey, counters, index, rng });
      if (pick) place(pick);
    }

    if (!has(d => index.proteinCategories.includes(d?.category))) {
      const pick = choose({ pool: proteins, used, lastUsed, weekKey, counters, index, rng });
      if (pick) place(pick);
    }

    if (rng() < SOUP_PROBABILITY && !has(d => d?.category === 'soup') && soups.length) {
      const pick = choose({ pool: soups, used, lastUsed, weekKey, counters, index, rng });
      if (pick) place(pick);
    }
  }

  return week;
}
```

Note: `Rice` is deliberately exempt from `used` — it is the nightly staple, not a variety choice. Every other dish obeys the no-repeat guarantee.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/generator.test.js`
Expected: PASS, all describes green.

If the soup pool has only 3 dishes and `SOUP_PROBABILITY` yields more than 3 soup nights on some seed, the fourth soup slot silently drops (`choose` returns null) rather than repeating — which is correct behaviour and already covered by the "no undefined entries" test.

- [ ] **Step 5: Commit**

```bash
git add js/domain/generator.js tests/generator.test.js
git commit -m "feat: weighted-LRU generator with category and prep rotation"
```

---

## Task 6: Persistence and v1→v3 migration

**Files:**
- Create: `js/core/persistence.js`
- Test: `tests/migration.test.js`

**Interfaces:**
- Consumes: `weekKey`, `DAYS` from `js/core/week.js`; `emptyWeek`, `addPlacement`, `toggleLockAt`, `dayIndex` from `js/core/plan.js`; `FALLBACK_ICON` from `js/domain/dishes.js`.
- Produces:
  - `STORAGE_KEY = 'weeklyMeals_v3'`
  - `RENAME_MAP: Record<string, string>` — legacy dish name → v3 dish id
  - `migrateV1(legacy, index) => State` — pure, takes the three parsed v1 blobs
  - `load(storage, index) => State`
  - `save(storage, state) => void`
  - `emptyState(weekKey) => State`

`State` is `{ version: 3, weeks: Week[], custom: Dish[], recipes: {[dishId]: string} }` — recipes keyed by **dish id**, `weeks[0]` the current week.

- [ ] **Step 1: Write the failing tests**

`tests/migration.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { indexDishes } from '../js/domain/dishes.js';
import { migrateV1, load, save, emptyState, STORAGE_KEY, RENAME_MAP } from '../js/core/persistence.js';

const manifest = JSON.parse(readFileSync(new URL('../data/dishes.json', import.meta.url), 'utf8'));
const index = indexDishes(manifest);

/** Minimal in-memory localStorage stand-in. */
function fakeStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    _dump: () => Object.fromEntries(map),
  };
}

describe('RENAME_MAP', () => {
  it('maps every legacy name to a real dish id', () => {
    for (const [legacy, id] of Object.entries(RENAME_MAP)) {
      expect(index.byId.has(id), `${legacy} -> ${id} is not a real id`).toBe(true);
    }
  });

  it('covers the merged and renamed dishes', () => {
    expect(RENAME_MAP['Kailan']).toBe('kai-lan');
    expect(RENAME_MAP['Steam Fish White Pomfret']).toBe('steam-fish-pomfret');
    expect(RENAME_MAP['Egg with Tomato']).toBe('tomato-egg-stirfry');
    expect(RENAME_MAP['Egg with Onion']).toBe('egg-onion-carrot');
    expect(RENAME_MAP['Egg with Carrot']).toBe('egg-onion-carrot');
  });
});

describe('migrateV1', () => {
  const legacy = {
    mealPlan: {
      lunch:  { monday: [{ name: 'Bee Hoon', emoji: 'x', category: 'noodles' }] },
      dinner: { monday: [
        { name: 'Rice', emoji: 'x', category: 'rice' },
        { name: 'Kailan', emoji: 'x', category: 'vegetables' },
        { name: 'Egg with Tomato', emoji: 'x', category: 'eggs', locked: true },
      ] },
    },
    customDishes: { lunch: [{ name: 'Nasi Lemak', emoji: 'x', category: 'rice', isCustom: true }], dinner: [] },
    recipes: { 'Egg with Tomato': 'Fry the tomatoes first.', 'Nasi Lemak': 'Coconut rice.' },
  };

  const ids = (s, meal, day) => s.weeks[0][meal][day].map(p => p.id);

  it('re-keys plan items from name to id', () => {
    const s = migrateV1(legacy, index);
    expect(ids(s, 'lunch', 0)).toEqual(['bee-hoon']);
    expect(ids(s, 'dinner', 0)).toContain('kai-lan');
    expect(ids(s, 'dinner', 0)).toContain('tomato-egg-stirfry');
  });

  it('carries locked flags onto the placement itself', () => {
    const s = migrateV1(legacy, index);
    const p = s.weeks[0].dinner[0].find(x => x.id === 'tomato-egg-stirfry');
    expect(p.lock).toBe(true);
  });

  it('leaves unlocked placements without a lock flag', () => {
    const s = migrateV1(legacy, index);
    expect(s.weeks[0].dinner[0].find(x => x.id === 'kai-lan').lock).toBeUndefined();
  });

  it('re-keys recipes from name to id', () => {
    const s = migrateV1(legacy, index);
    expect(s.recipes['tomato-egg-stirfry']).toBe('Fry the tomatoes first.');
  });

  it('preserves unknown dishes as custom dishes rather than dropping them', () => {
    const s = migrateV1(legacy, index);
    const nasi = s.custom.find(d => d.name === 'Nasi Lemak');
    expect(nasi).toBeDefined();
    expect(nasi.icon).toBe('_fallback');
  });

  it('keeps recipes attached to custom dishes', () => {
    const s = migrateV1(legacy, index);
    const nasi = s.custom.find(d => d.name === 'Nasi Lemak');
    expect(s.recipes[nasi.id]).toBe('Coconut rice.');
  });

  it('collapses both merged egg dishes onto one id in the same slot', () => {
    const both = {
      mealPlan: { lunch: {}, dinner: { monday: [
        { name: 'Egg with Onion', category: 'eggs' },
        { name: 'Egg with Carrot', category: 'eggs' },
      ] } },
      customDishes: { lunch: [], dinner: [] },
      recipes: {},
    };
    expect(migrateV1(both, index).weeks[0].dinner[0].map(p => p.id)).toEqual(['egg-onion-carrot']);
  });

  it('produces exactly one week, at version 3', () => {
    const s = migrateV1(legacy, index);
    expect(s.version).toBe(3);
    expect(s.weeks).toHaveLength(1);
  });

  it('creates seven slots per meal even where the legacy plan was sparse', () => {
    const s = migrateV1(legacy, index);
    expect(s.weeks[0].lunch).toHaveLength(7);
    expect(s.weeks[0].lunch[5]).toEqual([]);
  });
});

describe('load', () => {
  it('returns empty state when storage is untouched', () => {
    const s = load(fakeStorage(), index);
    expect(s.version).toBe(3);
    expect(s.weeks).toHaveLength(1);
  });

  it('migrates when only v1 keys are present', () => {
    const storage = fakeStorage({
      weeklyMealPlan_v1: JSON.stringify({ lunch: { monday: [{ name: 'Bee Hoon' }] }, dinner: {} }),
      customDishes_v1: JSON.stringify({ lunch: [], dinner: [] }),
      recipes_v1: JSON.stringify({}),
    });
    expect(load(storage, index).weeks[0].lunch[0].map(p => p.id)).toEqual(['bee-hoon']);
  });

  it('leaves v1 keys in place after migrating, for rollback', () => {
    const storage = fakeStorage({
      weeklyMealPlan_v1: JSON.stringify({ lunch: { monday: [{ name: 'Bee Hoon' }] }, dinner: {} }),
      customDishes_v1: JSON.stringify({ lunch: [], dinner: [] }),
      recipes_v1: JSON.stringify({}),
    });
    load(storage, index);
    expect(storage.getItem('weeklyMealPlan_v1')).not.toBeNull();
  });

  it('is idempotent — a second load does not re-migrate', () => {
    const storage = fakeStorage({
      weeklyMealPlan_v1: JSON.stringify({ lunch: { monday: [{ name: 'Bee Hoon' }] }, dinner: {} }),
      customDishes_v1: JSON.stringify({ lunch: [], dinner: [] }),
      recipes_v1: JSON.stringify({}),
    });
    const first = load(storage, index);
    save(storage, first);
    first.weeks[0].lunch[1].push({ id: 'porridge' });
    save(storage, first);
    const second = load(storage, index);
    expect(second.weeks[0].lunch[1].map(p => p.id)).toEqual(['porridge']);
  });

  it('falls back to empty state on corrupt JSON rather than throwing', () => {
    const storage = fakeStorage({ [STORAGE_KEY]: '{not json' });
    expect(() => load(storage, index)).not.toThrow();
    expect(load(storage, index).version).toBe(3);
  });
});

describe('save', () => {
  it('round-trips through storage', () => {
    const storage = fakeStorage();
    const s = emptyState('2026-07-27');
    s.weeks[0].lunch[0].push({ id: 'bee-hoon' });
    save(storage, s);
    expect(load(storage, index).weeks[0].lunch[0].map(p => p.id)).toEqual(['bee-hoon']);
  });

  it('preserves lock flags across a round trip', () => {
    const storage = fakeStorage();
    const s = emptyState('2026-07-27');
    s.weeks[0].dinner[3].push({ id: 'curry-chicken', lock: true });
    save(storage, s);
    expect(load(storage, index).weeks[0].dinner[3][0].lock).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/migration.test.js`
Expected: FAIL — cannot resolve `../js/core/persistence.js`.

- [ ] **Step 3: Implement `js/core/persistence.js`**

```js
import { weekKey, DAYS } from './week.js';
import { emptyWeek, addPlacement, toggleLockAt, dayIndex } from './plan.js';
import { FALLBACK_ICON } from '../domain/dishes.js';

export const STORAGE_KEY = 'weeklyMeals_v3';
const LEGACY = { plan: 'weeklyMealPlan_v1', custom: 'customDishes_v1', recipes: 'recipes_v1' };

/**
 * Legacy display name -> v3 dish id, for the merges and renames in the v3 spec.
 * Names not listed here are matched against the manifest by exact name;
 * anything still unmatched becomes a custom dish.
 */
export const RENAME_MAP = {
  'Kailan': 'kai-lan',
  'Kai Lan': 'kai-lan',
  'Steam Fish White Pomfret': 'steam-fish-pomfret',
  'Steam Fish Pomfret': 'steam-fish-pomfret',
  'Sliced Fish with Ginger': 'steam-fish-ginger-spring-onion',
  'Steam Fish (Ginger/Spring Onion)': 'steam-fish-ginger-spring-onion',
  'Egg with Onion': 'egg-onion-carrot',
  'Egg with Carrot': 'egg-onion-carrot',
  'Egg with Tomato': 'tomato-egg-stirfry',
  'Sliced Pork with Sichuan Veg': 'sliced-pork-sichuan-claypot',
};

export function emptyState(week = weekKey()) {
  return { version: 3, weeks: [emptyWeek(week)], custom: [], recipes: {} };
}

function slugify(name) {
  return `custom-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
}

/** Resolve a legacy display name to a v3 dish id, or null if unknown. */
function resolveName(name, index) {
  if (RENAME_MAP[name] && index.byId.has(RENAME_MAP[name])) return RENAME_MAP[name];
  const match = index.all.find(d => d.name.toLowerCase() === String(name).toLowerCase());
  return match ? match.id : null;
}

/**
 * Convert the three v1 blobs into v3 state. Pure.
 * `legacy` is { mealPlan, customDishes, recipes }, each already parsed.
 */
export function migrateV1(legacy, index) {
  const state = emptyState();
  const week = state.weeks[0];
  const nameToId = new Map();          // legacy name -> resolved id, for recipe re-keying

  const registerCustom = (name, meal, category) => {
    const id = slugify(name);
    if (!state.custom.some(c => c.id === id)) {
      state.custom.push({
        id, name, meals: [meal],
        category: category ?? 'other', prep: 'unknown',
        icon: FALLBACK_ICON, description: '', isCustom: true,
      });
    }
    nameToId.set(name, id);
    return id;
  };

  // Custom dishes first, so plan items can resolve against them.
  for (const meal of ['lunch', 'dinner']) {
    for (const d of legacy.customDishes?.[meal] ?? []) {
      const known = resolveName(d.name, index);
      if (known) nameToId.set(d.name, known);
      else registerCustom(d.name, meal, d.category);
    }
  }

  // Plan items. addPlacement de-duplicates, which matters because the v3
  // merges can collapse two legacy dishes onto one id in the same slot.
  for (const meal of ['lunch', 'dinner']) {
    for (const [dayName, items] of Object.entries(legacy.mealPlan?.[meal] ?? {})) {
      const day = dayIndex(dayName);
      if (day < 0) continue;                       // unknown day key — skip rather than throw
      for (const item of items ?? []) {
        const id = resolveName(item.name, index)
          ?? nameToId.get(item.name)
          ?? registerCustom(item.name, meal, item.category);
        addPlacement(week, meal, day, id);
        if (item.locked) toggleLockAt(week, meal, day, id);
      }
    }
  }

  // Recipes: name-keyed -> id-keyed.
  for (const [name, text] of Object.entries(legacy.recipes ?? {})) {
    const id = resolveName(name, index) ?? nameToId.get(name) ?? slugify(name);
    state.recipes[id] = text;
  }

  return state;
}

function parse(raw, fallback) {
  if (raw == null) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}

/** Load v3 state, migrating from v1 on first run. Never throws. */
export function load(storage, index) {
  const existing = parse(storage.getItem(STORAGE_KEY), null);
  if (existing && existing.version === 3) return existing;

  const hasLegacy = storage.getItem(LEGACY.plan) != null;
  if (!hasLegacy) return emptyState();

  return migrateV1({
    mealPlan: parse(storage.getItem(LEGACY.plan), { lunch: {}, dinner: {} }),
    customDishes: parse(storage.getItem(LEGACY.custom), { lunch: [], dinner: [] }),
    recipes: parse(storage.getItem(LEGACY.recipes), {}),
  }, index);
}

export function save(storage, state) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save state', e);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/migration.test.js`
Expected: PASS, 16 tests.

- [ ] **Step 5: Commit**

```bash
git add js/core/persistence.js tests/migration.test.js
git commit -m "feat: v3 persistence with lossless v1 migration"
```

---

## Task 7: Store

**Files:**
- Create: `js/core/store.js`
- Test: `tests/store.test.js`

**Interfaces:**
- Consumes: `load`, `save` from `js/core/persistence.js`; `rollTo`, `historyOf` from `js/core/history.js`; `weekKey` from `js/core/week.js`; the accessors from `js/core/plan.js`.
- Produces: `createStore({ storage, index, now }) => Store` with
  - `getState()`, `subscribe(fn) => unsubscribe`
  - `currentWeek()`, `history()`
  - `resolve(dishId)` — manifest dish or custom dish
  - `addDish(meal, dayName, dishId)`, `removeDish(meal, dayName, dishId)`
  - `toggleLock(meal, dayName, dishId)`, `isLocked(meal, dayName, dishId)`
  - `clearMeal(meal)` — drops unlocked placements, keeps pinned ones
  - `setWeek(week)` — replaces the current week wholesale (used by Generate)
  - `rollToWeek(weekOfKey)`
  - `setRecipe(dishId, text)`, `getRecipe(dishId)`
  - `addCustomDish({ name, meal, category, prep })`

Day arguments at the store boundary are **names** (`'monday'`), converted internally with `dayIndex`. This keeps `data-day="monday"` readable in the DOM while the index arithmetic stays in one place.

- [ ] **Step 1: Write the failing tests**

`tests/store.test.js`:

```js
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { indexDishes } from '../js/domain/dishes.js';
import { createStore } from '../js/core/store.js';

const manifest = JSON.parse(readFileSync(new URL('../data/dishes.json', import.meta.url), 'utf8'));
const index = indexDishes(manifest);

function fakeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

const mk = () => createStore({ storage: fakeStorage(), index, now: () => new Date('2026-07-29T10:00:00') });

/** Dish ids in a slot, addressed by day name for readability. */
const at = (s, meal, dayName) => {
  const i = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].indexOf(dayName);
  return s.currentWeek()[meal][i].map(p => p.id);
};

describe('store basics', () => {
  it('anchors the current week to its Monday', () => {
    expect(mk().currentWeek().weekOf).toBe('2026-07-27');
  });

  it('adds a dish to a day', () => {
    const s = mk();
    s.addDish('lunch', 'monday', 'bee-hoon');
    expect(at(s, 'lunch', 'monday')).toEqual(['bee-hoon']);
  });

  it('does not add the same dish twice to one day', () => {
    const s = mk();
    s.addDish('lunch', 'monday', 'bee-hoon');
    s.addDish('lunch', 'monday', 'bee-hoon');
    expect(at(s, 'lunch', 'monday')).toEqual(['bee-hoon']);
  });

  it('removes a dish', () => {
    const s = mk();
    s.addDish('dinner', 'monday', 'rice');
    s.addDish('dinner', 'monday', 'kai-lan');
    s.removeDish('dinner', 'monday', 'rice');
    expect(at(s, 'dinner', 'monday')).toEqual(['kai-lan']);
  });

  it('clears one meal without touching the other', () => {
    const s = mk();
    s.addDish('lunch', 'monday', 'bee-hoon');
    s.addDish('dinner', 'monday', 'rice');
    s.clearMeal('lunch');
    expect(at(s, 'lunch', 'monday')).toEqual([]);
    expect(at(s, 'dinner', 'monday')).toEqual(['rice']);
  });
});

describe('subscriptions', () => {
  it('notifies subscribers on change', () => {
    const s = mk();
    const spy = vi.fn();
    s.subscribe(spy);
    s.addDish('lunch', 'monday', 'bee-hoon');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('stops notifying after unsubscribe', () => {
    const s = mk();
    const spy = vi.fn();
    s.subscribe(spy)();
    s.addDish('lunch', 'monday', 'bee-hoon');
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('locks', () => {
  it('toggles a lock on and off', () => {
    const s = mk();
    s.addDish('lunch', 'monday', 'bee-hoon');
    s.toggleLock('lunch', 'monday', 'bee-hoon');
    expect(s.isLocked('lunch', 'monday', 'bee-hoon')).toBe(true);
    s.toggleLock('lunch', 'monday', 'bee-hoon');
    expect(s.isLocked('lunch', 'monday', 'bee-hoon')).toBe(false);
  });

  it('drops the lock when the dish is removed', () => {
    const s = mk();
    s.addDish('lunch', 'monday', 'bee-hoon');
    s.toggleLock('lunch', 'monday', 'bee-hoon');
    s.removeDish('lunch', 'monday', 'bee-hoon');
    expect(s.isLocked('lunch', 'monday', 'bee-hoon')).toBe(false);
  });

  it('keeps a pinned dish through clearMeal and drops the rest', () => {
    const s = mk();
    s.addDish('lunch', 'monday', 'bee-hoon');
    s.addDish('lunch', 'tuesday', 'porridge');
    s.toggleLock('lunch', 'monday', 'bee-hoon');
    s.clearMeal('lunch');
    expect(at(s, 'lunch', 'monday')).toEqual(['bee-hoon']);
    expect(at(s, 'lunch', 'tuesday')).toEqual([]);
    expect(s.isLocked('lunch', 'monday', 'bee-hoon')).toBe(true);
  });
});

describe('week rollover', () => {
  it('archives the outgoing week and starts a fresh one', () => {
    const s = mk();
    s.addDish('lunch', 'monday', 'bee-hoon');
    s.rollToWeek('2026-08-03');
    expect(s.currentWeek().weekOf).toBe('2026-08-03');
    expect(s.history()[0].weekOf).toBe('2026-07-27');
    expect(s.history()[0].lunch[0].map(p => p.id)).toEqual(['bee-hoon']);
  });

  it('starts the new week empty', () => {
    const s = mk();
    s.addDish('lunch', 'monday', 'bee-hoon');
    s.rollToWeek('2026-08-03');
    expect(at(s, 'lunch', 'monday')).toEqual([]);
  });

  it('discards an empty outgoing week rather than archiving it', () => {
    const s = mk();
    s.rollToWeek('2026-08-03');
    expect(s.history()).toHaveLength(0);
  });

  it('rolls over automatically when the stored week is stale', () => {
    const storage = fakeStorage();
    const a = createStore({ storage, index, now: () => new Date('2026-07-29T10:00:00') });
    a.addDish('lunch', 'monday', 'bee-hoon');
    const b = createStore({ storage, index, now: () => new Date('2026-08-05T10:00:00') });
    expect(b.currentWeek().weekOf).toBe('2026-08-03');
    expect(b.history()[0].weekOf).toBe('2026-07-27');
  });
});

describe('persistence', () => {
  it('writes through to storage on every mutation', () => {
    const storage = fakeStorage();
    const a = createStore({ storage, index, now: () => new Date('2026-07-29T10:00:00') });
    a.addDish('lunch', 'monday', 'bee-hoon');
    const b = createStore({ storage, index, now: () => new Date('2026-07-29T10:00:00') });
    expect(at(b, 'lunch', 'monday')).toEqual(['bee-hoon']);
  });
});

describe('setWeek', () => {
  it('replaces the current week wholesale', () => {
    const s = mk();
    s.addDish('lunch', 'monday', 'bee-hoon');
    const replacement = structuredClone(s.currentWeek());
    replacement.lunch[0] = [{ id: 'porridge' }];
    s.setWeek(replacement);
    expect(at(s, 'lunch', 'monday')).toEqual(['porridge']);
  });

  it('does not add a history entry', () => {
    const s = mk();
    s.setWeek(structuredClone(s.currentWeek()));
    expect(s.history()).toHaveLength(0);
  });
});

describe('recipes and custom dishes', () => {
  it('stores a recipe by dish id', () => {
    const s = mk();
    s.setRecipe('bee-hoon', 'Soak the noodles.');
    expect(s.getRecipe('bee-hoon')).toBe('Soak the noodles.');
  });

  it('adds a custom dish with the fallback icon', () => {
    const s = mk();
    const dish = s.addCustomDish({ name: 'Nasi Lemak', meal: 'lunch', category: 'rice', prep: 'steamed' });
    expect(dish.icon).toBe('_fallback');
    expect(s.getState().custom).toHaveLength(1);
  });

  it('makes custom dishes resolvable for rendering', () => {
    const s = mk();
    const dish = s.addCustomDish({ name: 'Nasi Lemak', meal: 'lunch', category: 'rice', prep: 'steamed' });
    expect(s.resolve(dish.id).name).toBe('Nasi Lemak');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/store.test.js`
Expected: FAIL — cannot resolve `../js/core/store.js`.

- [ ] **Step 3: Implement `js/core/store.js`**

```js
import { load, save } from './persistence.js';
import { rollTo, historyOf } from './history.js';
import { weekKey } from './week.js';
import {
  dayIndex, addPlacement, removePlacement, toggleLockAt, isLockedAt,
  clearMealKeepingLocks,
} from './plan.js';
import { FALLBACK_ICON } from '../domain/dishes.js';

/**
 * The single source of truth. The DOM renders from this and never the reverse.
 * Every mutation writes through to storage and notifies subscribers.
 */
export function createStore({ storage, index, now = () => new Date() }) {
  let state = load(storage, index);
  const listeners = new Set();

  // A stored week older than the real current week rolls over on open.
  const thisWeek = weekKey(now());
  if (state.weeks[0]?.weekOf !== thisWeek) {
    state = rollTo(state, thisWeek);
    save(storage, state);
  }

  function commit(next) {
    state = next;
    save(storage, state);
    for (const fn of listeners) fn(state);
  }

  /** Clone-mutate-commit. The draft's weeks[0] is passed to `fn` for convenience. */
  function mutate(fn) {
    const next = structuredClone(state);
    fn(next.weeks[0], next);
    commit(next);
  }

  return {
    getState: () => state,
    currentWeek: () => state.weeks[0],
    history: () => historyOf(state),

    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    /** Manifest dish or user-created custom dish, whichever matches. */
    resolve(dishId) {
      return index.byId.get(dishId) ?? state.custom.find(d => d.id === dishId) ?? null;
    },

    addDish(meal, dayName, dishId) {
      mutate(week => addPlacement(week, meal, dayIndex(dayName), dishId));
    },

    removeDish(meal, dayName, dishId) {
      // The lock lives on the placement, so it leaves with it — no cleanup.
      mutate(week => removePlacement(week, meal, dayIndex(dayName), dishId));
    },

    clearMeal(meal) {
      mutate(week => clearMealKeepingLocks(week, meal));
    },

    setWeek(week) {
      mutate((_, s) => { s.weeks[0] = week; });
    },

    toggleLock(meal, dayName, dishId) {
      mutate(week => toggleLockAt(week, meal, dayIndex(dayName), dishId));
    },

    isLocked(meal, dayName, dishId) {
      return isLockedAt(state.weeks[0], meal, dayIndex(dayName), dishId);
    },

    rollToWeek(nextWeek) {
      commit(rollTo(state, nextWeek));
    },

    setRecipe(dishId, text) {
      mutate((_, s) => { s.recipes[dishId] = text; });
    },

    getRecipe(dishId) {
      return state.recipes[dishId] ?? '';
    },

    addCustomDish({ name, meal, category, prep = 'unknown' }) {
      const id = `custom-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
      const dish = { id, name, meals: [meal], category, prep, icon: FALLBACK_ICON, description: '', isCustom: true };
      mutate((_, s) => {
        if (!s.custom.some(d => d.id === id)) s.custom.push(dish);
      });
      return dish;
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/store.test.js`
Expected: PASS, 17 tests.

- [ ] **Step 5: Run the whole suite to check nothing regressed**

Run: `npm test`
Expected: all suites PASS.

- [ ] **Step 6: Commit**

```bash
git add js/core/store.js tests/store.test.js
git commit -m "feat: single-source-of-truth store with write-through persistence"
```

---

## Task 8: Icon system and sprite build

**Files:**
- Create: `icons/src/_fallback.svg`, `icons/src/_pin.svg`
- Create: `scripts/build-sprite.js`
- Create: `js/ui/icons.js`
- Generated: `icons/sprite.svg`

**Interfaces:**
- Consumes: `FALLBACK_ICON` from `js/domain/dishes.js`.
- Produces:
  - `injectSprite(doc, url?) => Promise<void>` — inlines the sprite once
  - `iconMarkup(iconId) => string` — an `<svg><use href="#id"></svg>` string
  - `hasSymbol(doc, iconId) => boolean`

- [ ] **Step 1: Create the two UI marks**

Both live in the same 24px / 1.5px stroke system as the dish icons to come. Names are underscore-prefixed so `validate.js` does not report them as orphans.

`icons/src/_fallback.svg` — a plate outline, standing in for every dish until Phase 2:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
     stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="8.25"/>
  <circle cx="12" cy="12" r="4.25"/>
</svg>
```

`icons/src/_pin.svg` — the pin toggle on each placed dish:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
     stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M9.5 3.5h5l-.75 5 2.75 2.5v1.5H7.5V11l2.75-2.5z"/>
  <path d="M12 12.5V20"/>
</svg>
```

- [ ] **Step 2: Implement `scripts/build-sprite.js`**

```js
#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'icons/src');
const outFile = join(root, 'icons/sprite.svg');

if (!existsSync(srcDir)) { mkdirSync(srcDir, { recursive: true }); }

const files = readdirSync(srcDir).filter(f => f.endsWith('.svg')).sort();
const symbols = files.map(file => {
  const id = file.replace(/\.svg$/, '');
  const raw = readFileSync(join(srcDir, file), 'utf8');

  const viewBox = raw.match(/viewBox="([^"]+)"/)?.[1] ?? '0 0 24 24';
  // Strip the outer <svg> wrapper, keeping only its children.
  const inner = raw.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').trim();

  return `  <symbol id="${id}" viewBox="${viewBox}" fill="none" stroke="currentColor"
    stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">\n${inner}\n  </symbol>`;
}).join('\n');

writeFileSync(outFile, `<svg xmlns="http://www.w3.org/2000/svg" style="display:none">\n${symbols}\n</svg>\n`);
console.log(`Built ${outFile} with ${files.length} symbol(s)`);
```

- [ ] **Step 3: Build the sprite**

Run: `npm run build:icons`
Expected: `Built .../icons/sprite.svg with 2 symbol(s)`

- [ ] **Step 4: Implement `js/ui/icons.js`**

```js
import { FALLBACK_ICON } from '../domain/dishes.js';

let injected = false;

/**
 * Inline the sprite once so <use href="#id"> resolves without a
 * per-icon network request. Safe to call repeatedly.
 */
export async function injectSprite(doc = document, url = 'icons/sprite.svg') {
  if (injected) return;
  injected = true;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`sprite ${res.status}`);
    const host = doc.createElement('div');
    host.hidden = true;
    host.innerHTML = await res.text();
    doc.body.prepend(host);
  } catch (e) {
    console.error('Icon sprite failed to load', e);
  }
}

export function hasSymbol(doc, iconId) {
  return Boolean(doc.getElementById(iconId));
}

/**
 * Markup for one dish icon. Decorative — the dish name carries the
 * accessible meaning, so the svg is hidden from assistive tech.
 */
export function iconMarkup(iconId, doc = document) {
  const id = iconId && hasSymbol(doc, iconId) ? iconId : FALLBACK_ICON;
  return `<svg class="dish-icon" aria-hidden="true" focusable="false"><use href="#${id}"/></svg>`;
}
```

- [ ] **Step 5: Verify the validator now reports sprite coverage**

Run: `npm run validate`
Expected: exit 0. Warnings that each dish icon is "not in sprite (falls back)" are correct and expected — Phase 2 supplies the real icons.

- [ ] **Step 6: Commit**

```bash
git add icons scripts/build-sprite.js js/ui/icons.js
git commit -m "feat: SVG sprite pipeline with generic fallback mark"
```

---

## Task 9: Delegated action dispatch

**Files:**
- Create: `js/ui/actions.js`
- Test: `tests/actions.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `createDispatcher(root) => { on(name, handler), attach(), detach() }`

Replaces all 16 inline `onclick=""` attributes and all 20 `window.*` assignments. Handlers receive `(element, event)` and read parameters from `data-*` attributes.

- [ ] **Step 1: Write the failing tests**

`tests/actions.test.js`:

```js
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDispatcher } from '../js/ui/actions.js';

describe('createDispatcher', () => {
  let root, dispatcher;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="root">
        <button data-action="generate">Generate</button>
        <button data-action="remove" data-meal="lunch" data-day="monday" data-dish="bee-hoon">x</button>
        <button data-action="nothing-registered">?</button>
        <span id="inner"><button data-action="generate" id="nested">G</button></span>
      </div>`;
    root = document.getElementById('root');
    dispatcher = createDispatcher(root);
    dispatcher.attach();
  });

  it('routes a click to the registered handler', () => {
    const spy = vi.fn();
    dispatcher.on('generate', spy);
    root.querySelector('[data-action="generate"]').click();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('passes the element so handlers can read data attributes', () => {
    const spy = vi.fn();
    dispatcher.on('remove', spy);
    root.querySelector('[data-action="remove"]').click();
    const el = spy.mock.calls[0][0];
    expect(el.dataset.meal).toBe('lunch');
    expect(el.dataset.dish).toBe('bee-hoon');
  });

  it('finds the action on an ancestor when the click lands on a child', () => {
    const spy = vi.fn();
    dispatcher.on('generate', spy);
    document.getElementById('nested').click();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('ignores actions with no registered handler', () => {
    expect(() => root.querySelector('[data-action="nothing-registered"]').click()).not.toThrow();
  });

  it('stops routing after detach', () => {
    const spy = vi.fn();
    dispatcher.on('generate', spy);
    dispatcher.detach();
    root.querySelector('[data-action="generate"]').click();
    expect(spy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Install jsdom and enable it per-file**

```bash
npm install --save-dev jsdom
```

The `// @vitest-environment jsdom` pragma at the top of the test file switches that file only; the Node default in `vitest.config.js` stays for the pure-logic suites.

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/actions.test.js`
Expected: FAIL — cannot resolve `../js/ui/actions.js`.

- [ ] **Step 4: Implement `js/ui/actions.js`**

```js
/**
 * One delegated click listener for the whole app.
 *
 * Replaces inline onclick="" attributes and the window.* function exports
 * they required. Handler names live in a registry that can be audited in
 * one place, instead of being resolved from strings scattered through HTML.
 */
export function createDispatcher(root) {
  const handlers = new Map();

  function onClick(event) {
    const el = event.target.closest('[data-action]');
    if (!el || !root.contains(el)) return;
    const handler = handlers.get(el.dataset.action);
    if (!handler) return;
    handler(el, event);
  }

  return {
    on(name, handler) { handlers.set(name, handler); return this; },
    attach() { root.addEventListener('click', onClick); },
    detach() { root.removeEventListener('click', onClick); },
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/actions.test.js`
Expected: PASS, 5 tests.

- [ ] **Step 6: Commit**

```bash
git add js/ui/actions.js tests/actions.test.js package.json package-lock.json
git commit -m "feat: delegated data-action dispatch, replacing inline onclick"
```

---

## Task 10: Design tokens and base styles

**Files:**
- Create: `styles/tokens.css`, `styles/base.css`, `styles/layout.css`, `styles/components.css`, `styles/main.css`
- Modify: `index.html` (stylesheet link and viewport meta)
- Delete: `styles.css`

**Interfaces:**
- Consumes: nothing.
- Produces: the class names Tasks 11–13 render against — `.week-grid`, `.day-card`, `.day-card__header`, `.day-card__items`, `.dish`, `.dish__icon`, `.dish__name`, `.dish--locked`, `.btn`, `.btn--primary`, `.sheet`, `.modal`, `.toast`.

- [ ] **Step 1: Write `styles/tokens.css`**

```css
:root {
  /* Type — system stack renders as SF on Apple devices, with no network fetch */
  --font-sans: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI Variable",
               "Segoe UI", system-ui, sans-serif;
  --text-xs: 0.75rem; --text-sm: 0.8125rem; --text-base: 0.9375rem;
  --text-lg: 1.0625rem; --text-xl: 1.375rem; --text-2xl: 1.75rem;
  --tracking-tight: -0.022em;

  /* Spacing — 4px base */
  --space-1: 0.25rem; --space-2: 0.5rem;  --space-3: 0.75rem;
  --space-4: 1rem;    --space-5: 1.5rem;  --space-6: 2rem;

  --radius-sm: 8px; --radius-md: 12px; --radius-lg: 16px; --radius-full: 999px;

  --bg:            #f2f2f7;
  --bg-elevated:   #ffffff;
  --bg-sunken:     #e5e5ea;
  --separator:     rgba(60, 60, 67, 0.18);
  --text:          #1c1c1e;
  --text-secondary:#6c6c70;
  --text-tertiary: #aeaeb2;
  --accent:        #ff6b35;
  --accent-soft:   rgba(255, 107, 53, 0.12);
  --scrim:         rgba(0, 0, 0, 0.32);

  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 16px rgba(0,0,0,0.10);
  --shadow-lg: 0 12px 40px rgba(0,0,0,0.18);

  --ease-spring: cubic-bezier(0.32, 0.72, 0, 1);
  --duration: 320ms;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg:            #000000;
    --bg-elevated:   #1c1c1e;
    --bg-sunken:     #2c2c2e;
    --separator:     rgba(84, 84, 88, 0.65);
    --text:          #ffffff;
    --text-secondary:#98989d;
    --text-tertiary: #48484a;
    --accent:        #ff7d4d;
    --accent-soft:   rgba(255, 125, 77, 0.18);
    --scrim:         rgba(0, 0, 0, 0.6);
  }
}

@media (prefers-reduced-motion: reduce) {
  :root { --duration: 1ms; }
}
```

- [ ] **Step 2: Write `styles/base.css`**

```css
*, *::before, *::after { box-sizing: border-box; }
* { margin: 0; }

html { -webkit-text-size-adjust: 100%; }

body {
  font-family: var(--font-sans);
  font-size: var(--text-base);
  letter-spacing: var(--tracking-tight);
  line-height: 1.45;
  color: var(--text);
  background: var(--bg);
  -webkit-font-smoothing: antialiased;
  min-height: 100dvh;
}

h1, h2, h3 { font-weight: 600; letter-spacing: -0.03em; line-height: 1.2; }
button { font: inherit; color: inherit; background: none; border: 0; cursor: pointer; }
svg { display: block; }

:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}
```

- [ ] **Step 3: Write `styles/layout.css`**

```css
.app { max-width: 1200px; margin-inline: auto; padding: var(--space-4); }

.week-grid {
  display: grid;
  gap: var(--space-3);
  grid-template-columns: repeat(2, 1fr);
}
@media (min-width: 600px)  { .week-grid { grid-template-columns: repeat(3, 1fr); } }
@media (min-width: 768px)  { .week-grid { grid-template-columns: repeat(4, 1fr); } }
@media (min-width: 1024px) { .week-grid { grid-template-columns: repeat(7, 1fr); } }

.day-card {
  background: var(--bg-elevated);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-height: 120px;
  transition: box-shadow var(--duration) var(--ease-spring);
}
.day-card:hover { box-shadow: var(--shadow-md); }
.day-card--today { outline: 2px solid var(--accent); outline-offset: -2px; }

.day-card__header {
  font-size: var(--text-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-secondary);
}

.day-card__items { display: flex; flex-direction: column; gap: var(--space-1); flex: 1; }
```

- [ ] **Step 4: Write `styles/components.css`**

```css
.dish {
  display: flex;
  align-items: stretch;
  border-radius: var(--radius-md);
  background: var(--bg-sunken);
  min-height: 44px;
  overflow: hidden;
  transition: background var(--duration) var(--ease-spring);
}
.dish:hover { background: var(--accent-soft); }
.dish--locked { box-shadow: inset 0 0 0 1.5px var(--accent); }

.dish__body {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2);
  flex: 1;
  min-width: 0;
  text-align: left;
}

.dish__pin {
  display: grid;
  place-items: center;
  width: 36px;
  flex: none;
  color: var(--text-tertiary);
  transition: color var(--duration) var(--ease-spring);
}
.dish__pin[aria-pressed="true"] { color: var(--accent); }

.dish__icon { width: 24px; height: 24px; flex: none; color: var(--text-secondary); }
.dish__name {
  font-size: var(--text-sm); line-height: 1.3;
  overflow: hidden; text-overflow: ellipsis;
}

.dish-icon { width: 100%; height: 100%; }

.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: var(--space-2);
  min-height: 44px; padding-inline: var(--space-4);
  border-radius: var(--radius-full);
  font-weight: 500;
  background: var(--bg-elevated);
  box-shadow: var(--shadow-sm);
  transition: transform var(--duration) var(--ease-spring), background var(--duration) var(--ease-spring);
}
.btn:active { transform: scale(0.97); }
.btn--primary { background: var(--accent); color: #fff; }

.sheet, .modal {
  position: fixed; z-index: 50;
  background: var(--bg-elevated);
  box-shadow: var(--shadow-lg);
}
.sheet {
  inset: auto 0 0 0;
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  padding: var(--space-4);
  max-height: 80dvh; overflow-y: auto;
  transform: translateY(100%);
  transition: transform var(--duration) var(--ease-spring);
  padding-bottom: max(var(--space-4), env(safe-area-inset-bottom));
}
.sheet[data-open="true"] { transform: translateY(0); }

.scrim {
  position: fixed; inset: 0; z-index: 40;
  background: var(--scrim);
  opacity: 0; pointer-events: none;
  transition: opacity var(--duration) var(--ease-spring);
}
.scrim[data-open="true"] { opacity: 1; pointer-events: auto; }

.modal {
  inset: 50% auto auto 50%;
  transform: translate(-50%, -50%);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  width: min(90vw, 420px);
}
.modal[hidden] { display: none; }

.toast {
  position: fixed; z-index: 60;
  left: 50%; bottom: var(--space-6);
  transform: translate(-50%, 1rem);
  background: var(--text); color: var(--bg);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-full);
  box-shadow: var(--shadow-md);
  opacity: 0;
  transition: opacity var(--duration) var(--ease-spring), transform var(--duration) var(--ease-spring);
}
.toast[data-open="true"] { opacity: 1; transform: translate(-50%, 0); }
```

- [ ] **Step 5: Write `styles/main.css`**

```css
@import url("tokens.css");
@import url("base.css");
@import url("layout.css");
@import url("components.css");
```

- [ ] **Step 6: Update `index.html` head**

Replace the viewport meta and stylesheet links. Remove `maximum-scale=1.0, user-scalable=no` (it blocks pinch-zoom) and both Google Fonts `<link>`s plus the `preconnect` pair:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="Plan your family's lunches and dinners for the week.">
<meta name="theme-color" content="#ff6b35">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="manifest" href="manifest.webmanifest">
<link rel="stylesheet" href="styles/main.css">
```

- [ ] **Step 7: Delete the old stylesheet**

```bash
git rm styles.css
```

- [ ] **Step 8: Commit**

```bash
git add styles index.html
git commit -m "feat: Apple-style design tokens; drop Google Fonts and pinch-zoom block"
```

---

## Task 11: Render the week from state

**Files:**
- Create: `js/ui/day-card.js`
- Modify: `index.html` — replace the 14 hardcoded day cards (lines 70–241) with two empty grid containers
- Test: `tests/day-card.test.js`

**Interfaces:**
- Consumes: `iconMarkup` from `js/ui/icons.js`; `DAYS` from `js/core/week.js`; store's `resolve`.
- Produces: `renderWeek(container, { meal, week, store, todayKey })` — idempotent full re-render of one meal's 7-day grid. `week` is a `Week` from `plan.js`; lock state is read off each placement, not queried separately.

- [ ] **Step 1: Replace the hardcoded day cards in `index.html`**

Delete lines 70–241 (both `#lunch-page` and `#dinner-page` inner grids and the desktop food drawers) and substitute:

```html
<section id="lunch-page" class="page" data-meal="lunch">
  <div class="week-grid" id="lunchGrid"></div>
</section>
<section id="dinner-page" class="page" hidden data-meal="dinner">
  <div class="week-grid" id="dinnerGrid"></div>
</section>
```

- [ ] **Step 2: Write the failing tests**

`tests/day-card.test.js`:

```js
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { indexDishes } from '../js/domain/dishes.js';
import { createStore } from '../js/core/store.js';
import { renderWeek } from '../js/ui/day-card.js';

const manifest = JSON.parse(readFileSync(new URL('../data/dishes.json', import.meta.url), 'utf8'));
const index = indexDishes(manifest);

function fakeStorage() {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) };
}

describe('renderWeek', () => {
  let container, store;

  beforeEach(() => {
    document.body.innerHTML = '<div id="grid"></div>';
    container = document.getElementById('grid');
    store = createStore({ storage: fakeStorage(), index, now: () => new Date('2026-07-29T10:00:00') });
  });

  const render = () => renderWeek(container, {
    meal: 'lunch', week: store.currentWeek(), store, todayKey: 'wednesday',
  });

  it('renders seven day cards', () => {
    render();
    expect(container.querySelectorAll('.day-card')).toHaveLength(7);
  });

  it('labels each card with its day', () => {
    render();
    expect(container.querySelector('[data-day="monday"] .day-card__header').textContent).toBe('Monday');
  });

  it('marks today', () => {
    render();
    expect(container.querySelector('[data-day="wednesday"]').classList.contains('day-card--today')).toBe(true);
  });

  it('renders a dish name, not an emoji', () => {
    store.addDish('lunch', 'monday', 'bee-hoon');
    render();
    const card = container.querySelector('[data-day="monday"]');
    expect(card.querySelector('.dish__name').textContent).toBe('Bee Hoon');
  });

  it('renders an svg icon for each dish', () => {
    store.addDish('lunch', 'monday', 'bee-hoon');
    render();
    expect(container.querySelector('[data-day="monday"] svg use')).not.toBeNull();
  });

  it('gives each dish a data-action for removal', () => {
    store.addDish('lunch', 'monday', 'bee-hoon');
    render();
    const el = container.querySelector('[data-day="monday"] .dish__body');
    expect(el.dataset.action).toBe('dish-tap');
    expect(el.dataset.dish).toBe('bee-hoon');
    expect(el.dataset.meal).toBe('lunch');
    expect(el.dataset.day).toBe('monday');
  });

  it('gives each dish a pin toggle', () => {
    store.addDish('lunch', 'monday', 'bee-hoon');
    render();
    const pin = container.querySelector('[data-day="monday"] .dish__pin');
    expect(pin.dataset.action).toBe('toggle-pin');
    expect(pin.getAttribute('aria-pressed')).toBe('false');
  });

  it('marks pinned dishes and reflects it on the pin control', () => {
    store.addDish('lunch', 'monday', 'bee-hoon');
    store.toggleLock('lunch', 'monday', 'bee-hoon');
    render();
    expect(container.querySelector('.dish').classList.contains('dish--locked')).toBe(true);
    expect(container.querySelector('.dish__pin').getAttribute('aria-pressed')).toBe('true');
  });

  it('is idempotent — re-rendering does not duplicate cards', () => {
    render(); render(); render();
    expect(container.querySelectorAll('.day-card')).toHaveLength(7);
  });

  it('renders custom dishes by name with the fallback icon', () => {
    const d = store.addCustomDish({ name: 'Nasi Lemak', meal: 'lunch', category: 'rice' });
    store.addDish('lunch', 'tuesday', d.id);
    render();
    expect(container.querySelector('[data-day="tuesday"] .dish__name').textContent).toBe('Nasi Lemak');
  });

  it('renders an empty card without throwing', () => {
    expect(() => render()).not.toThrow();
    expect(container.querySelector('[data-day="friday"] .day-card__items').children).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/day-card.test.js`
Expected: FAIL — cannot resolve `../js/ui/day-card.js`.

- [ ] **Step 4: Implement `js/ui/day-card.js`**

```js
import { DAYS } from '../core/week.js';
import { iconMarkup } from './icons.js';

const label = (day) => day.charAt(0).toUpperCase() + day.slice(1);

const escapeHtml = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function dishMarkup({ dish, meal, day, locked }) {
  const attrs = `data-meal="${meal}" data-day="${day}" data-dish="${dish.id}"`;
  return `
    <div class="dish${locked ? ' dish--locked' : ''}">
      <button class="dish__body" data-action="dish-tap" ${attrs}
              aria-label="Remove ${escapeHtml(dish.name)}">
        <span class="dish__icon">${iconMarkup(dish.icon)}</span>
        <span class="dish__name">${escapeHtml(dish.name)}</span>
      </button>
      <button class="dish__pin" data-action="toggle-pin" ${attrs}
              aria-pressed="${locked}" aria-label="${locked ? 'Unpin' : 'Pin'} ${escapeHtml(dish.name)}">
        <svg class="dish-icon" aria-hidden="true" focusable="false"><use href="#_pin"/></svg>
      </button>
    </div>`;
}

/**
 * Full re-render of one meal's seven-day grid. Idempotent: the container's
 * contents are replaced, so calling this on every store change is correct
 * and there is no incremental-update path to get out of sync.
 *
 * Lock state comes off the placement itself, so a dish and its pin can
 * never disagree.
 */
export function renderWeek(container, { meal, week, store, todayKey }) {
  container.innerHTML = DAYS.map((day, i) => {
    const items = week[meal][i].map(p => {
      const dish = store.resolve(p.id);
      if (!dish) return '';
      return dishMarkup({ dish, meal, day, locked: Boolean(p.lock) });
    }).join('');

    return `
      <article class="day-card${day === todayKey ? ' day-card--today' : ''}"
               data-day="${day}" data-meal="${meal}">
        <h3 class="day-card__header">${label(day)}</h3>
        <div class="day-card__items">${items}</div>
        <button class="btn btn--add" data-action="open-picker" data-meal="${meal}" data-day="${day}"
                aria-label="Add a dish to ${label(day)}">+</button>
      </article>`;
  }).join('');
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/day-card.test.js`
Expected: PASS, 10 tests.

- [ ] **Step 6: Commit**

```bash
git add js/ui/day-card.js tests/day-card.test.js index.html
git commit -m "feat: render week grid from state, replacing 14 hardcoded day cards"
```

---

## Task 12: Picker, modals, and history view

**Files:**
- Create: `js/ui/picker.js`, `js/ui/modals.js`, `js/ui/history-view.js`
- Modify: `index.html` — sheet, modal, and history containers
- Test: `tests/picker.test.js`

**Interfaces:**
- Consumes: store, `indexDishes` output, `iconMarkup`.
- Produces:
  - `renderPicker(sheetEl, { meal, day, state, store, category })`
  - `openSheet(el)`, `closeSheet(el)`
  - `showToast(message)`
  - `openModal(id)`, `closeModal(id)`
  - `renderHistory(container, { state, store })`

- [ ] **Step 1: Replace the sheet and modal markup in `index.html`**

Replace the existing `#bottomSheet` block and all five modal blocks (removing every `onclick=""`):

```html
<div class="scrim" id="scrim" data-action="close-overlays"></div>

<div class="sheet" id="picker" role="dialog" aria-modal="true" aria-label="Add a dish">
  <header class="sheet__header">
    <h2 id="pickerTitle">Add a dish</h2>
    <button class="btn" data-action="close-overlays" aria-label="Close">Done</button>
  </header>
  <nav class="sheet__categories" id="pickerCategories"></nav>
  <div class="sheet__items" id="pickerItems"></div>
</div>

<div class="modal" id="historyModal" role="dialog" aria-modal="true" aria-label="Past weeks" hidden>
  <header class="modal__header"><h2>Past weeks</h2>
    <button class="btn" data-action="close-overlays" aria-label="Close">Done</button></header>
  <div id="historyList"></div>
</div>

<div class="modal" id="recipeModal" role="dialog" aria-modal="true" aria-label="Recipe" hidden>
  <header class="modal__header"><h2 id="recipeTitle">Recipe</h2></header>
  <textarea id="recipeText" rows="8"></textarea>
  <button class="btn btn--primary" data-action="save-recipe">Save</button>
</div>

<div class="modal" id="addDishModal" role="dialog" aria-modal="true" aria-label="Add a custom dish" hidden>
  <header class="modal__header"><h2>New dish</h2></header>
  <label>Name <input id="newDishName" type="text"></label>
  <label>Category <select id="newDishCategory"></select></label>
  <button class="btn btn--primary" data-action="save-custom-dish">Add</button>
</div>

<div class="toast" id="toast" role="status" aria-live="polite"></div>
```

- [ ] **Step 2: Write the failing tests**

`tests/picker.test.js`:

```js
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { indexDishes } from '../js/domain/dishes.js';
import { createStore } from '../js/core/store.js';
import { renderPicker } from '../js/ui/picker.js';

const manifest = JSON.parse(readFileSync(new URL('../data/dishes.json', import.meta.url), 'utf8'));
const index = indexDishes(manifest);

function fakeStorage() {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) };
}

describe('renderPicker', () => {
  let sheet, store;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="picker">
        <nav id="pickerCategories"></nav>
        <div id="pickerItems"></div>
      </div>`;
    sheet = document.getElementById('picker');
    store = createStore({ storage: fakeStorage(), index, now: () => new Date('2026-07-29T10:00:00') });
  });

  const render = (meal = 'lunch', category = null) =>
    renderPicker(sheet, { meal, day: 'monday', state: store.getState(), store, index, category });

  it('lists a category tab per category for the meal', () => {
    render('dinner');
    const tabs = sheet.querySelectorAll('#pickerCategories [data-action="pick-category"]');
    expect(tabs.length).toBe(manifest.categories.dinner.length);
  });

  it('shows only dishes for the selected meal', () => {
    render('lunch');
    const ids = [...sheet.querySelectorAll('[data-dish]')].map(el => el.dataset.dish);
    expect(ids).not.toContain('rice');
    expect(ids.every(id => index.byId.get(id).meals.includes('lunch'))).toBe(true);
  });

  it('filters to one category when given', () => {
    render('dinner', 'vegetables');
    const ids = [...sheet.querySelectorAll('[data-dish]')].map(el => el.dataset.dish);
    expect(ids.every(id => index.byId.get(id).category === 'vegetables')).toBe(true);
  });

  it('renders dish names without emoji', () => {
    render('lunch');
    const first = sheet.querySelector('[data-dish] .dish__name');
    expect(first.textContent.trim()).toMatch(/^[\w\s()'/-]+$/u);
  });

  it('tags each option with the target day and meal', () => {
    render('lunch');
    const el = sheet.querySelector('[data-dish]');
    expect(el.dataset.action).toBe('add-dish');
    expect(el.dataset.day).toBe('monday');
    expect(el.dataset.meal).toBe('lunch');
  });

  it('includes custom dishes for that meal', () => {
    const d = store.addCustomDish({ name: 'Nasi Lemak', meal: 'lunch', category: 'rice' });
    renderPicker(sheet, { meal: 'lunch', day: 'monday', state: store.getState(), store, index, category: null });
    const ids = [...sheet.querySelectorAll('[data-dish]')].map(el => el.dataset.dish);
    expect(ids).toContain(d.id);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/picker.test.js`
Expected: FAIL — cannot resolve `../js/ui/picker.js`.

- [ ] **Step 4: Implement `js/ui/picker.js`**

```js
import { iconMarkup } from './icons.js';

const escapeHtml = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const title = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Manifest dishes for `meal`, plus any custom dishes the user added for it. */
function dishesFor(meal, state, index) {
  return [...index.forMeal(meal), ...state.custom.filter(d => d.meals.includes(meal))];
}

export function renderPicker(sheet, { meal, day, state, store, index, category = null }) {
  const cats = index.categories[meal] ?? [];

  sheet.querySelector('#pickerCategories').innerHTML = cats.map(c => `
    <button class="btn btn--chip${c === category ? ' btn--chip-active' : ''}"
            data-action="pick-category" data-category="${c}" data-meal="${meal}" data-day="${day}">
      ${title(c)}
    </button>`).join('');

  const items = dishesFor(meal, state, index)
    .filter(d => !category || d.category === category)
    .sort((a, b) => a.name.localeCompare(b.name));

  sheet.querySelector('#pickerItems').innerHTML = items.map(d => `
    <button class="dish" data-action="add-dish"
            data-dish="${d.id}" data-meal="${meal}" data-day="${day}">
      <span class="dish__icon">${iconMarkup(d.icon)}</span>
      <span class="dish__name">${escapeHtml(d.name)}</span>
    </button>`).join('');
}

export function openSheet(el, scrim) {
  el.dataset.open = 'true';
  if (scrim) scrim.dataset.open = 'true';
}

export function closeSheet(el, scrim) {
  delete el.dataset.open;
  if (scrim) delete scrim.dataset.open;
}
```

- [ ] **Step 5: Implement `js/ui/modals.js`**

```js
let toastTimer;

export function openModal(doc, id, scrim) {
  const el = doc.getElementById(id);
  if (!el) return;
  el.hidden = false;
  if (scrim) scrim.dataset.open = 'true';
}

export function closeModal(doc, id, scrim) {
  const el = doc.getElementById(id);
  if (!el) return;
  el.hidden = true;
  if (scrim) delete scrim.dataset.open;
}

export function closeAll(doc) {
  for (const el of doc.querySelectorAll('.modal')) el.hidden = true;
  const sheet = doc.getElementById('picker');
  if (sheet) delete sheet.dataset.open;
  const scrim = doc.getElementById('scrim');
  if (scrim) delete scrim.dataset.open;
}

export function showToast(doc, message) {
  const el = doc.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.dataset.open = 'true';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => delete el.dataset.open, 2400);
}
```

- [ ] **Step 6: Implement `js/ui/history-view.js`**

```js
import { DAYS } from '../core/week.js';

const escapeHtml = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const pretty = (key) => new Date(`${key}T00:00:00`)
  .toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/** Read-only list of past weeks, each with a "copy to this week" action. */
export function renderHistory(container, { store }) {
  const history = store.history();

  if (history.length === 0) {
    container.innerHTML = '<p class="empty">No past weeks yet. Generate a week and it will appear here next week.</p>';
    return;
  }

  container.innerHTML = history.map(week => {
    const summary = DAYS.map((day, i) => {
      const names = [...week.lunch[i], ...week.dinner[i]]
        .map(p => store.resolve(p.id)?.name)
        .filter(Boolean);
      return names.length
        ? `<li><strong>${day.slice(0, 3)}</strong> ${escapeHtml(names.join(', '))}</li>`
        : '';
    }).join('');

    return `
      <section class="history-week">
        <header>
          <h3>Week of ${pretty(week.weekOf)}</h3>
          <button class="btn" data-action="copy-week" data-week="${week.weekOf}">Copy to this week</button>
        </header>
        <ul class="history-week__days">${summary}</ul>
      </section>`;
  }).join('');
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run tests/picker.test.js`
Expected: PASS, 6 tests.

- [ ] **Step 8: Commit**

```bash
git add js/ui/picker.js js/ui/modals.js js/ui/history-view.js tests/picker.test.js index.html
git commit -m "feat: picker, modals, and history browser rendered from state"
```

---

## Task 13: Wire it together — main.js and the Generate Week button

**Files:**
- Create: `js/main.js`
- Modify: `index.html` — header actions and the module script tag
- Delete: `js/app.js`, `js/ui.js`, `js/state.js`, `js/data.js`, `js/suggest.js`, `js/share.js`

**Interfaces:**
- Consumes: everything built in Tasks 2–12.
- Produces: the running app. No exports.

- [ ] **Step 1: Replace the header actions in `index.html`**

Remove the kebab menu and its five `onclick` entries; the single primary action is Generate:

```html
<header class="app__header">
  <h1>Weekly Meals</h1>
  <div class="app__actions">
    <div class="segmented" role="tablist">
      <button class="segmented__btn" data-action="show-meal" data-meal="lunch"
              role="tab" aria-selected="true">Lunch</button>
      <button class="segmented__btn" data-action="show-meal" data-meal="dinner"
              role="tab" aria-selected="false">Dinner</button>
    </div>
    <button class="btn" data-action="open-history">History</button>
    <button class="btn" data-action="clear-meal">Clear</button>
    <button class="btn btn--primary" data-action="generate-week">Generate week</button>
  </div>
</header>
```

- [ ] **Step 2: Point the script tag at the new entry**

```html
<script type="module" src="js/main.js"></script>
```

- [ ] **Step 3: Implement `js/main.js`**

```js
import { loadDishes } from './domain/dishes.js';
import { generateWeek } from './domain/generator.js';
import { createStore } from './core/store.js';
import { DAYS, weekKey } from './core/week.js';
import { injectSprite } from './ui/icons.js';
import { createDispatcher } from './ui/actions.js';
import { renderWeek } from './ui/day-card.js';
import { renderPicker, openSheet, closeSheet } from './ui/picker.js';
import { openModal, closeAll, showToast } from './ui/modals.js';
import { renderHistory } from './ui/history-view.js';
import { APP_VERSION } from './version.js';

const todayKey = () => DAYS[(new Date().getDay() + 6) % 7];

async function boot() {
  await injectSprite(document);
  const index = await loadDishes();
  const store = createStore({ storage: localStorage, index });

  const scrim = document.getElementById('scrim');
  const picker = document.getElementById('picker');
  let activeMeal = 'lunch';
  let pickerTarget = { meal: 'lunch', day: 'monday', category: null };
  let recipeTarget = null;

  function render() {
    const week = store.currentWeek();
    renderWeek(document.getElementById('lunchGrid'),  { meal: 'lunch',  week, store, todayKey: todayKey() });
    renderWeek(document.getElementById('dinnerGrid'), { meal: 'dinner', week, store, todayKey: todayKey() });
    document.getElementById('lunch-page').hidden  = activeMeal !== 'lunch';
    document.getElementById('dinner-page').hidden = activeMeal !== 'dinner';
    for (const btn of document.querySelectorAll('[data-action="show-meal"]')) {
      btn.setAttribute('aria-selected', String(btn.dataset.meal === activeMeal));
    }
  }

  store.subscribe(render);

  const dispatcher = createDispatcher(document.body);

  dispatcher
    .on('show-meal', (el) => { activeMeal = el.dataset.meal; render(); })

    .on('generate-week', () => {
      const base = store.currentWeek();
      store.setWeek(generateWeek({
        index,
        history: store.history(),
        weekKey: base.weekOf,
        base,                       // carries pinned dishes through
      }));
      showToast(document, 'Week generated');
    })

    .on('clear-meal', () => {
      store.clearMeal(activeMeal);
      showToast(document, `${activeMeal === 'lunch' ? 'Lunch' : 'Dinner'} cleared`);
    })

    .on('open-picker', (el) => {
      pickerTarget = { meal: el.dataset.meal, day: el.dataset.day, category: null };
      renderPicker(picker, { ...pickerTarget, state: store.getState(), store, index });
      openSheet(picker, scrim);
    })

    .on('pick-category', (el) => {
      pickerTarget = { ...pickerTarget, category: el.dataset.category };
      renderPicker(picker, { ...pickerTarget, state: store.getState(), store, index });
    })

    .on('add-dish', (el) => {
      store.addDish(el.dataset.meal, el.dataset.day, el.dataset.dish);
      closeSheet(picker, scrim);
    })

    .on('dish-tap', (el) => {
      const { meal, day, dish } = el.dataset;
      store.removeDish(meal, day, dish);
      showToast(document, 'Removed');
    })

    // Pinning survives Generate and Clear — the generator fills around it.
    .on('toggle-pin', (el, event) => {
      event.stopPropagation();      // the pin sits inside the dish button
      const { meal, day, dish } = el.dataset;
      store.toggleLock(meal, day, dish);
      showToast(document, store.isLocked(meal, day, dish) ? 'Pinned' : 'Unpinned');
    })

    .on('open-history', () => {
      renderHistory(document.getElementById('historyList'), { store });
      openModal(document, 'historyModal', scrim);
    })

    .on('copy-week', (el) => {
      const past = store.history().find(w => w.weekOf === el.dataset.week);
      if (!past) return;
      // Keep the current week's identity; only its contents are copied.
      store.setWeek({ ...structuredClone(past), weekOf: store.currentWeek().weekOf });
      closeAll(document);
      showToast(document, 'Copied to this week');
    })

    .on('save-recipe', () => {
      if (!recipeTarget) return;
      store.setRecipe(recipeTarget, document.getElementById('recipeText').value);
      closeAll(document);
      showToast(document, 'Recipe saved');
    })

    .on('save-custom-dish', () => {
      const name = document.getElementById('newDishName').value.trim();
      if (!name) return;
      const category = document.getElementById('newDishCategory').value;
      store.addCustomDish({ name, meal: activeMeal, category });
      closeAll(document);
      showToast(document, `${name} added`);
    })

    .on('close-overlays', () => { closeAll(document); });

  dispatcher.attach();

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAll(document);
  });

  render();
  console.info(`Weekly Meals v${APP_VERSION}`);
}

boot().catch(err => {
  console.error('Failed to start', err);
  document.body.insertAdjacentHTML('afterbegin',
    '<p role="alert" class="boot-error">Something went wrong loading the app. Please refresh.</p>');
});
```

- [ ] **Step 4: Delete the superseded modules**

```bash
git rm js/app.js js/ui.js js/state.js js/data.js js/suggest.js js/share.js
```

- [ ] **Step 5: Verify no inline handlers or globals remain**

Run: `grep -rn "onclick=" index.html; grep -rn "window\." js/`
Expected: no output from either. If anything remains, remove it before committing.

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: all suites PASS.

- [ ] **Step 7: Serve locally and click through**

Run: `npx wrangler pages dev . --port 8788`

Verify by hand:
1. Grid renders 7 lunch cards; switching to Dinner renders 7 dinner cards.
2. **Generate week** fills both meals; every dinner has rice + 1 veg + 1 protein, some have a soup.
3. No dish repeats within either meal.
4. Reload — the plan persists.
5. Tapping `+` opens the sheet; picking a dish adds it and closes the sheet.
6. Tapping a placed dish removes it.
7. History is empty on first run (correct — history fills on week rollover).
8. Pinch-zoom works.
9. No console errors.

- [ ] **Step 8: Commit**

```bash
git add js/main.js index.html
git commit -m "feat: wire store, generator, and UI; one-button week generation"
```

---

## Task 14: PWA, final validation, and cleanup

**Files:**
- Create: `manifest.webmanifest`, `sw.js`, `favicon.svg`
- Modify: `index.html`, `.assetsignore`

**Interfaces:**
- Consumes: everything prior.
- Produces: an installable, offline-capable app.

- [ ] **Step 1: Create `favicon.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
     stroke="#ff6b35" stroke-width="1.5" stroke-linecap="round">
  <circle cx="12" cy="12" r="9"/>
  <circle cx="12" cy="12" r="4"/>
</svg>
```

- [ ] **Step 2: Create `manifest.webmanifest`**

```json
{
  "name": "Weekly Meals",
  "short_name": "Meals",
  "description": "Plan your family's lunches and dinners for the week.",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#f2f2f7",
  "theme_color": "#ff6b35",
  "icons": [
    { "src": "favicon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any" }
  ]
}
```

- [ ] **Step 3: Create `sw.js`**

```js
const CACHE = 'weekly-meals-v3';
const ASSETS = [
  '/', '/index.html',
  '/styles/main.css', '/styles/tokens.css', '/styles/base.css',
  '/styles/layout.css', '/styles/components.css',
  '/data/dishes.json', '/icons/sprite.svg',
  '/js/main.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network-first so a deploy is picked up promptly; cache is the offline fallback.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then(r => r ?? caches.match('/index.html')))
  );
});
```

- [ ] **Step 4: Register the service worker in `js/main.js`**

Append inside `boot()`, after `render()`:

```js
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW registration failed', e));
  }
```

- [ ] **Step 5: Confirm no dead files remain**

Run: `git ls-files | grep -E "master_styles|js/(ui|app|state|data|suggest|share)\.js|^styles\.css$"`
Expected: no output.

- [ ] **Step 6: Run validation and the full suite**

Run: `npm run build:icons && npm run validate && npm test`
Expected: sprite builds, validator exits 0, all tests PASS.

- [ ] **Step 7: Check the deployed payload contains no dead weight**

Run: `npx wrangler pages deploy . --project-name=lunch-menu --dry-run`
Expected: the file list excludes `docs/`, `tests/`, `icons/src/`, `node_modules/`, and both former `master_styles` files, and includes `data/dishes.json` and `icons/sprite.svg`.

- [ ] **Step 8: Commit**

```bash
git add manifest.webmanifest sw.js favicon.svg index.html js/main.js .assetsignore
git commit -m "feat: PWA manifest, offline service worker, and favicon"
```

- [ ] **Step 9: Push the branch**

```bash
git push -u origin feat/overhaul-v3
```

Do NOT deploy to production. Production stays on v2.0.5 until Phase 2 lands the real icon set.

---

## Phase 2 preview (not part of this plan)

Blocked on the human-authored `description` field for all 49 dishes in `data/dishes.json`. When those land:

1. Draw 49 SVGs into `icons/src/<icon-id>.svg`, 24px grid, 1.5px stroke, using `prep` as the systematic differentiator (steam wisps, fried crispness, claypot vessel).
2. `npm run build:icons` — the sprite absorbs them automatically.
3. `npm run validate` — the "not in sprite" warnings disappear; any typo surfaces as a warning naming the dish.
4. No JavaScript changes. `iconMarkup` already resolves each `dish.icon` and falls back when absent.
5. Deploy.

---

## Self-Review

**Spec coverage** — every section of the design spec maps to a task:

| Spec section | Task |
|---|---|
| §3 Dish data model, category/prep axes | 3 |
| §3 Pool feasibility guard | 3 (validator + tests) |
| §4 Generation, composition, caps, locks | 5 |
| §5 History, `weekOf`, 12-week retention | 4, 7 |
| §6 State shape — unified `weeks`, placement locks, fixed day arrays | 4 |
| §6 O(1) last-used index | 4 (`buildLastUsedIndex`), consumed in 5 |
| §7 Data migration | 6 |
| §8 Store, no globals, module split | 7, 9, 11, 12, 13 |
| §8 Build scripts | 3, 8 |
| §9 Visual design, a11y, fonts | 10 |
| §10 Testing | 1 and throughout |
| §11 Phasing, fallback icon | 8, 14 |
| Dead CSS removal | 1 |
| PWA basics | 14 |

**Placeholder scan** — no TBDs; every code step contains runnable code; no step says "add error handling" without showing it.

**Type consistency** — verified across task boundaries after the data-model revision:

- `indexDishes` returns `{all, byId, forMeal, byCategory, categories, proteinCategories}`; Tasks 5, 6, 11, 12 use exactly those.
- `plan.js` accessors (`emptyWeek`, `dayIndex`, `slotOf`, `addPlacement`, `removePlacement`, `toggleLockAt`, `isLockedAt`, `lockedPlacements`, `clearMealKeepingLocks`, `idsIn`, `isEmpty`, `MAX_WEEKS`) are declared in Task 4 and imported by Tasks 5, 6, 7.
- `generateWeek({index, history, weekKey, base, rng}) => Week` in Task 5 matches its call site in Task 13.
- Store methods declared in Task 7 (`currentWeek`, `history`, `resolve`, `isLocked`, `toggleLock`, `setWeek`, `addCustomDish`) match their uses in Tasks 11–13.
- `renderWeek(container, {meal, week, store, todayKey})` in Task 11 matches Task 13. `renderHistory(container, {store})` in Task 12 matches Task 13.
- `iconMarkup(iconId)` in Task 8 matches Tasks 11 and 12. `FALLBACK_ICON` is defined once in Task 3 and imported by Tasks 6, 7, 8.
- State field names are `weeks` / `custom` / `recipes` throughout. The only `customDishes` reference remaining is `legacy.customDishes` in Task 6, which is deliberately the **v1** storage key being migrated *from*.
- `data-action` names emitted by Tasks 11–12 (`dish-tap`, `toggle-pin`, `open-picker`, `pick-category`, `add-dish`, `copy-week`, `close-overlays`) all have handlers registered in Task 13.

**Gap found and closed during review:** locks were reachable from the store and honoured by the generator but had no UI affordance, so no user could ever set one. Task 11 now renders a `.dish__pin` toggle per placed dish, Task 13 registers `toggle-pin`, and Task 8 adds `icons/src/_pin.svg`.
