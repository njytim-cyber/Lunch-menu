# Weekly Meals — Codebase Optimisation & UX Overhaul

**Date:** 2026-07-31
**Status:** Approved
**Branch:** `feat/overhaul-v3`
**Repo:** `njytim-cyber/Lunch-menu` → deployed as Cloudflare Pages project `lunch-menu` → `weekly-meals.com`

---

## 1. Context

A static, build-step-free meal planner: hand-written HTML, CSS, and ES modules served directly by Cloudflare Pages (`wrangler.jsonc` sets `assets.directory = "."`). Currently v2.0.5.

### Problems in the current build

| Area | Problem |
|---|---|
| Dead assets | `master_styles.css` (53 KB) and `master_styles_utf8.css` (26 KB) are unreferenced but not in `.assetsignore`, so ~79 KB of dead CSS ships to every visitor |
| Coupling | 20 functions assigned to `window` so inline `onclick=""` attributes can reach them; HTML↔JS bound by unchecked strings |
| State | The DOM *is* the state. `handleGlobalClear` mutates DOM and `mealPlan` separately; `generateDinnerForDay` reads categories back out of `dataset` |
| File size | `js/ui.js` is 45 KB — over half the JS |
| Data | 53 imperative `addFoodItem()` calls; one exact duplicate; naming variants treated as distinct dishes |
| Generation | Samples with replacement — no cross-week *or* within-week deduplication. ~93% chance of a repeated vegetable in any generated week |
| Dead feature | The soup branch never fires: no seed dish carries `category: 'soup'` |
| Dead feature | `toggleLockItem` / `getLockedItems` exist in state but `autoSuggest` calls `clearDayCard()` first, wiping locks |
| A11y | `user-scalable=no, maximum-scale=1.0` blocks pinch-zoom |
| Perf | Render-blocking Google Fonts fetch for Outfit |
| PWA | No manifest, no service worker, no favicon, no meta description |

---

## 2. Goals

1. **Optimise the codebase** — state-as-truth, no globals, split modules, delete dead weight.
2. **Overhaul the UX** — Apple-style visual language; thin-line SVGs replacing all emoji.
3. **One-button generation** — a single action fills both lunch and dinner for the week.
4. **History** — browsable past weeks, feeding a generator that avoids recent repeats.

### Non-goals

- Cross-device sync / accounts / backend. Storage stays `localStorage`.
- Nutrition tracking beyond the existing item counts.
- Any framework. It stays vanilla ES modules with no runtime dependencies.

---

## 3. Dish data model

53 source entries reduce to **49 dishes** via 5 merges plus removal of one lunch/dinner duplicate.

| Action | Detail |
|---|---|
| Delete | `Cheesy Rigatoni` dinner entry — lunch only |
| Merge | `Kai Lan` + `Kailan` → **Kai Lan** |
| Merge | `Steam Fish Pomfret` + `Steam Fish White Pomfret` → **Steam Fish Pomfret** |
| Merge | `Sliced Fish with Ginger` + `Steam Fish (Ginger/Spring Onion)` → **Steam Fish with Ginger and Spring Onion** |
| Merge | `Egg with Onion` + `Egg with Carrot` → **Egg with Onion and Carrot** |
| Rename | `Egg with Tomato` → **Chinese Tomato and Egg Stir-fry** |
| Rename | `Sliced Pork with Sichuan Veg` → **Sliced Pork with Sichuan Vegetables in Claypot** |
| Add | **Stir-fried Thai Style Sliced Pork with Garlic** (`pork`) |
| Retag | 3 dinner soups → `category: soup`; `Claypot Tofu` → `category: tofu` |

### Two orthogonal axes

Collapsing "what it is" and "how it's cooked" into one field caused the dead soup branch. They separate:

- **`category`** — which pool the dish draws from (`noodles`, `rice`, `fish`, `pork`, …)
- **`prep`** — cooking method (`dry`, `soup`, `fried`, `steamed`, `stir-fried`, `braised`, `claypot`, `baked`, `tossed`, `boiled`, `blanched`)

`Mee Sua Soup` is therefore `category: noodles` + `prep: soup` — a lunch noodle main that happens to be soupy. The three *dinner* soups are `category: soup`, because there the soup is its own dish slot.

### Manifest

`data/dishes.json`, with `id` as stable identity and `name` free to change:

```json
{ "id": "kai-lan", "name": "Kai Lan", "meals": ["dinner"],
  "category": "vegetables", "prep": "stir-fried",
  "icon": "kai-lan", "description": "" }
```

`description` is the human-authored brief each SVG is drawn from (HITL, in progress).

### Pool sizes

**Lunch — 17:** pasta 6 · rice 5 · noodles 6
**Dinner — 32:** vegetables 8 · pork 6 · fish 5 · chicken 4 · soup 3 · eggs 2 · prawn 2 · rice 1 · tofu 1
**Proteins — 20** (fish + pork + chicken + eggs + prawn + tofu)

### Known content constraint

At 7 weekly slots, runway before a pool must repeat:

| Pool | Dishes | Weeks |
|---|---|---|
| Vegetables | 8 | **1.1** — saturated |
| Lunch mains | 17 | 2.4 |
| Proteins | 20 | 2.9 |
| Soup (fires ~40%) | 3 | ~1.0 |

The within-week no-repeat guarantee holds for vegetables (8 ≥ 7) but *cross-week* vegetable variety is mathematically unavailable — every week will use 7 of 8. **This is a content limit, not an algorithm limit.** Adding ~6 vegetables would give that pool parity with the others. Documented so the generator is not blamed for it.

---

## 4. Generation

A single **Generate Week** action fills lunch and dinner together.

### Composition

- **Lunch:** 1 main per day, from the 17-dish lunch pool.
- **Dinner:** Rice (always) + 1 vegetable + 1 protein + optional soup at *p* = 0.4 → **3–4 items**.

### Selection

For each slot, candidates are scored and sampled proportionally:

```
score(dish) = w_recency × w_category × w_prep × jitter

w_recency  = min(weeks_since_last_use, CAP)²      never-used → CAP²
w_category = penalty if category already at its weekly cap
w_prep     = penalty if prep already at its weekly cap
```

Dishes already placed this week are excluded outright, giving a **hard within-week no-repeat guarantee**.

### Rotation caps (per week)

- Each protein category capped at 2 nights. Six categories × 2 = 12 ≥ 7 slots, so the cap is always satisfiable.
- `prep: fried` capped at 2 dinners — prevents a week of Fried Seabass / Fried Chicken Wing / Pork Cutlet / Crispy Prawn Ball, which category rotation alone permits.
- `prep: soup` capped at 2 lunches.

Caps degrade before the no-repeat guarantee does: if a cap cannot be met, it relaxes; the within-week uniqueness never does.

### Locks

Revives the orphaned `locked` flag. Locked dishes are pre-placed before generation, excluded from candidate pools, and count toward rotation caps. Regeneration fills around them.

---

## 5. History

The app currently has no notion of *which* week is being planned — days are bare `monday`…`sunday` strings. History needs an anchor.

- Each plan gains **`weekOf`** — the ISO date of that week's Monday, e.g. `2026-07-27`.
- On generate, or on first edit of a new week, the previous plan is snapshotted into history.
- **12-week rolling retention.**
- History is browsable in the UI (read-only, with "copy to current week").
- `history.lastUsedWeek(dishId)` supplies the generator's `weeks_since_last_use`.

---

## 6. State shape

Three structural decisions, each removing a class of bug rather than saving bytes. At ~14 KB for 13 weeks the storage size is irrelevant against a ~5 MB quota, so the shape is optimised for correctness and lookup cost, not compactness.

```js
{
  version: 3,
  weeks: [                       // newest first; weeks[0] IS the current week
    { weekOf: "2026-07-27",
      lunch:  [ [{id:"bee-hoon"}], [], [], [], [], [], [] ],          // 7 fixed slots, Mon..Sun
      dinner: [ [{id:"rice"},{id:"kai-lan"},{id:"curry-chicken",lock:true}], [], … ] }
  ],
  custom:  [ { id, name, meals, category, prep, icon } ],
  recipes: { [dishId]: "free text" }
}
```

**1. One `weeks` array, not `current` + `history`.** They had identical shape but separate homes, which forced a copy-then-reset on rollover plus a special case for "don't snapshot an empty week". Unified, rollover is `unshift(emptyWeek(nextKey))` and retention is `slice(0, 13)` — current week plus 12 of history.

**2. Locks live on the placement, not in a parallel tree.** A mirrored `locks` structure would require every add/remove/clear to mutate two trees in step — the same dual-mutation pattern behind this repo's regression history, relocated into the state layer. With `{id, lock: true}`, desync is unrepresentable: removing a placement removes its lock. `clearMeal` becomes "keep locked placements, drop the rest", which is also better behaviour than wiping pins.

**3. Days are fixed 7-element arrays, not sparse objects.** Index 0–6 is Monday–Sunday. Removes every `?? []` guard and the day-name string keys.

### Derived index for generation

`weeksSinceLastUse` as a scan is accidentally quadratic — it would rebuild a `Set` of every dish in every history week, per candidate, per slot (~132,000 set insertions per generate). Instead a `Map<dishId, weekOf>` is built once per run by walking `weeks[1…]` newest-first, where the first occurrence of an id is by construction its most recent use. ~420 insertions once, then O(1) per lookup.

---

## 7. Data migration

Existing users hold three name-keyed `localStorage` entries: `weeklyMealPlan_v1`, `customDishes_v1`, `recipes_v1`. Since `recipes` is keyed by **display name**, the renames in §3 would orphan saved recipes. Migration is mandatory, not optional.

- New single key `weeklyMeals_v3`, versioned, holding `{ version, current, history, customDishes, recipes }`.
- Recipes and plan items re-key from **name → id** through an explicit rename map covering all 5 merges and 2 renames.
- Names not in the manifest are preserved as **custom dishes** with the fallback icon — no user data is dropped.
- Migration runs once, is idempotent, and leaves v1 keys untouched so a rollback is possible.

---

## 8. Architecture

```
index.html
styles/     tokens · base · layout · components · main
data/       dishes.json · dishes.schema.json
icons/      src/*.svg (49, deferred) → sprite.svg (built)
js/
  main.js              entry: store → render → events
  core/
    store.js           single source of truth, subscribe/notify
    persistence.js     localStorage adapters + schema migration
    history.js         week snapshots, LRU queries
    week.js            ISO week helpers
  domain/
    dishes.js          load and index the manifest
    generator.js       weighted LRU + category/prep rotation
  ui/
    actions.js         delegated data-action dispatch
    day-card.js · picker.js · modals.js · history-view.js
    icons.js           sprite injection, <use> helper
scripts/
  release.js · build-sprite.js · validate.js
tests/
  generator · history · migration
```

### Key inversions

1. **State as truth.** The store is authoritative; DOM is a pure render of it. Removes the dual-mutation pattern behind most of the repo's regression history.
2. **No globals.** All 20 `window.*` assignments deleted. Inline `onclick=""` replaced by `data-action` attributes and one delegated listener, so handler names are resolved in one auditable place.
3. **Data out of code.** Dishes move from 53 imperative calls to a declarative manifest, editable without touching JS.

### Build steps (dev-only, output committed)

- `build-sprite.js` — concatenates `icons/src/*.svg` into one `<symbol>` sprite. 49 icons, 1 request, `currentColor` for theming.
- `validate.js` — asserts every `dish.icon` resolves to a real symbol and flags orphan icons. Guards against the likeliest failure mode: a typo rendering a blank square in production.

Runtime stays dependency-free; Cloudflare still serves static files.

---

## 9. Visual design

- **Type:** system font stack (SF on Apple devices), removing the render-blocking Google Fonts request.
- **Surface:** generous whitespace, 12–16px radii, hairline separators, layered translucency for sheets.
- **Motion:** spring-eased transitions, respecting `prefers-reduced-motion`.
- **Colour:** restrained accent; the thin-line icons carry the personality. Light/dark via `prefers-color-scheme`.
- **Icons:** 1.5px stroke on a 24px grid, round caps and joins, no fill. `prep` gives each icon a systematic differentiator — steam wisps vs. a crisp fried outline — so 49 bespoke drawings share one visual logic rather than resting on 49 independent artistic decisions.
- **A11y:** `user-scalable=no` removed; ≥44px touch targets; focus-visible rings; icons are decorative with text labels carrying meaning.

---

## 10. Testing

No test infrastructure exists today. Vitest is added as a dev-only dependency (runtime stays dependency-free) covering the pure logic where correctness actually matters:

- **generator** — within-week uniqueness holds across many seeded runs; rotation caps respected; locks preserved; degrades without dead-ends when a pool is exhausted.
- **history** — snapshot on week rollover; 12-week trim; `lastUsedWeek` correctness.
- **migration** — v1 → v3 for each rename and merge; unknown names survive as custom dishes; idempotent on re-run.

---

## 11. Sequencing

**Phase 1 — code + UX.** Everything above except the icon artwork. Ships with a single generic fallback mark used by every dish; the icon system is fully built and wired, just pointing at one placeholder. Production stays on the current version through this phase.

**Phase 2 — icons.** 49 bespoke SVGs drawn from the `description` field, authored during the HITL pass on `data/dishes.json`. Swaps in with no code change: sprite content plus `icon` ids only. Production cuts over when complete.

Splitting this way keeps the icon work — the bulk of the effort, and the part blocked on human input — off the critical path for everything else.

---

## 12. Open items

| Item | Status |
|---|---|
| 49 dish `description` fields | **HITL in progress** — blocks Phase 2 |
| Dish names / `prep` corrections | **HITL in progress** — `id`s frozen, so safe in parallel |
| `Fish Ball Noodle` prep | Defaulted to `dry`; trivially reversible |
| `Fish and Fish Soup` name | Appears to be a typo in the original data; flagged for HITL |
| Vegetable pool depth | 8 dishes for 7 slots — content decision, deferred to the user |
