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
  const i = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].indexOf(dayName);
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
    const dish = s.addCustomDish({ name: 'Nasi Goreng', meal: 'lunch', category: 'rice', prep: 'fried' });
    expect(dish.icon).toBe('_fallback');
    expect(s.getState().custom).toHaveLength(1);
  });

  it('makes custom dishes resolvable for rendering', () => {
    const s = mk();
    const dish = s.addCustomDish({ name: 'Nasi Goreng', meal: 'lunch', category: 'rice', prep: 'fried' });
    expect(s.resolve(dish.id).name).toBe('Nasi Goreng');
  });
});
