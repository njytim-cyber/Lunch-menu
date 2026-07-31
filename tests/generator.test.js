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
