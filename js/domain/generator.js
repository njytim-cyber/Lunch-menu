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
 * them would leave no candidate at all. A soft weight penalty was tried
 * first and is wrong: with a large pool, 2% of a large weight still wins
 * occasionally, so a third pork night slips through. Filter, then fall
 * back — never merely discourage.
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
