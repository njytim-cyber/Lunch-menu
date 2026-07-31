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
  };
}

/** Every dish name that existed in the v1 seed data. */
const V1_NAMES = [
  'Rigatoni', 'Mushroom Fusilli', 'Cheese and Pepper pasta', 'Pistachio Pesto with chicken',
  'Cheesy Rigatoni', 'Chicken Pasta and Broccoli', 'Chicken Rice', 'Soy Chicken and Chye Sim',
  'Chicken and Mushroom Rice', 'Crispy Noodle', 'Bee Hoon', 'Mee Sua Soup', 'Kway Teow Soup',
  'Porridge', 'Fried Rice',
  'Rice', 'Kai Lan', 'Baby Spinach', 'Red Spinach', 'Kang Kong', 'WaWa Vegetable', 'Broccoli',
  'Kailan', 'Sliced Fish with Ginger', 'Claypot Sliced Fish with Eggplant', 'Fried Seabass',
  'Fried Salmon', 'Steam Fish Pomfret', 'Steam Fish White Pomfret', 'Fish and Fish Soup',
  'Steam Fish (Ginger/Spring Onion)', 'Egg with Onion', 'Egg with Carrot', 'Egg with Tomato',
  'Claypot Tofu', 'Corn Soup', 'Steamed Chicken with Mushrooms', 'Chicken with Salted Bean Paste',
  'Curry Chicken', 'Fried Chicken Wing', 'Steamed Minced Pork', 'Sliced Pork with Sichuan Veg',
  'Pork with Egg and Tau Pok', 'Japanese Pork Cutlet', 'Pork Rib Soup', 'Crispy Prawn Ball',
  'Prawn with Glass Noodle',
];

/** Dropped in v3 — these SHOULD become custom dishes, not manifest dishes. */
const V1_DROPPED = [
  'Bee Hoon and Seaweed Chicken', 'Fish Ball Noodle', 'Cabbage', 'Baby Kailan',
  'Sliced Pork with Parsley',
];

describe('RENAME_MAP', () => {
  it('maps every legacy name to a real dish id', () => {
    for (const [legacy, id] of Object.entries(RENAME_MAP)) {
      expect(index.byId.has(id), `${legacy} -> ${id} is not a real id`).toBe(true);
    }
  });

  it('covers every surviving v1 dish name', () => {
    const missing = V1_NAMES.filter(n => !RENAME_MAP[n]);
    expect(missing, `unmapped v1 names: ${missing.join(', ')}`).toEqual([]);
  });

  it('does not map the five dishes dropped in v3', () => {
    for (const n of V1_DROPPED) {
      expect(RENAME_MAP[n], `${n} should not map — it was deleted`).toBeUndefined();
    }
  });

  it('covers the merges', () => {
    expect(RENAME_MAP['Kailan']).toBe('kai-lan');
    expect(RENAME_MAP['Steam Fish White Pomfret']).toBe('steam-fish-pomfret');
    expect(RENAME_MAP['Egg with Tomato']).toBe('tomato-egg-stirfry');
    expect(RENAME_MAP['Egg with Onion']).toBe('egg-onion-carrot');
    expect(RENAME_MAP['Egg with Carrot']).toBe('egg-onion-carrot');
  });

  it('maps renamed dishes that no longer match by name', () => {
    // These are the ones a name-equality fallback would have missed.
    expect(RENAME_MAP['Chicken Rice']).toBe('chicken-rice');
    expect(RENAME_MAP['Pork Rib Soup']).toBe('pork-rib-soup');
    expect(index.byId.get('pork-rib-soup').name).toBe('Bak Kut Teh');
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
    customDishes: { lunch: [{ name: 'Nasi Goreng', emoji: 'x', category: 'rice', isCustom: true }], dinner: [] },
    recipes: { 'Egg with Tomato': 'Fry the tomatoes first.', 'Nasi Goreng': 'Fry the rice hard.' },
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
    expect(s.weeks[0].dinner[0].find(x => x.id === 'tomato-egg-stirfry').lock).toBe(true);
  });

  it('leaves unlocked placements without a lock flag', () => {
    const s = migrateV1(legacy, index);
    expect(s.weeks[0].dinner[0].find(x => x.id === 'kai-lan').lock).toBeUndefined();
  });

  it('re-keys recipes from name to id', () => {
    expect(migrateV1(legacy, index).recipes['tomato-egg-stirfry']).toBe('Fry the tomatoes first.');
  });

  it('preserves unknown dishes as custom dishes rather than dropping them', () => {
    const nasi = migrateV1(legacy, index).custom.find(d => d.name === 'Nasi Goreng');
    expect(nasi).toBeDefined();
    expect(nasi.icon).toBe('_fallback');
  });

  it('keeps recipes attached to custom dishes', () => {
    const s = migrateV1(legacy, index);
    const nasi = s.custom.find(d => d.name === 'Nasi Goreng');
    expect(s.recipes[nasi.id]).toBe('Fry the rice hard.');
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

  it('turns the five dropped dishes into custom dishes, preserving history', () => {
    const dropped = {
      mealPlan: { lunch: { monday: [{ name: 'Fish Ball Noodle', category: 'noodles' }] },
                  dinner: { tuesday: [{ name: 'Cabbage', category: 'vegetables' }] } },
      customDishes: { lunch: [], dinner: [] },
      recipes: {},
    };
    const s = migrateV1(dropped, index);
    expect(s.custom.map(d => d.name)).toContain('Fish Ball Noodle');
    expect(s.custom.map(d => d.name)).toContain('Cabbage');
    expect(s.weeks[0].lunch[0]).toHaveLength(1);
    expect(s.weeks[0].dinner[1]).toHaveLength(1);
  });

  it('maps every surviving v1 name onto a manifest dish, creating no customs', () => {
    const everything = {
      mealPlan: { lunch: {}, dinner: {} },
      customDishes: { lunch: [], dinner: [] },
      recipes: Object.fromEntries(V1_NAMES.map(n => [n, 'x'])),
    };
    const s = migrateV1(everything, index);
    expect(s.custom).toEqual([]);
    for (const id of Object.keys(s.recipes)) {
      expect(index.byId.has(id), `${id} is not a manifest dish`).toBe(true);
    }
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
  const seeded = () => fakeStorage({
    weeklyMealPlan_v1: JSON.stringify({ lunch: { monday: [{ name: 'Bee Hoon' }] }, dinner: {} }),
    customDishes_v1: JSON.stringify({ lunch: [], dinner: [] }),
    recipes_v1: JSON.stringify({}),
  });

  it('returns empty state when storage is untouched', () => {
    const s = load(fakeStorage(), index);
    expect(s.version).toBe(3);
    expect(s.weeks).toHaveLength(1);
  });

  it('migrates when only v1 keys are present', () => {
    expect(load(seeded(), index).weeks[0].lunch[0].map(p => p.id)).toEqual(['bee-hoon']);
  });

  it('leaves v1 keys in place after migrating, for rollback', () => {
    const storage = seeded();
    load(storage, index);
    expect(storage.getItem('weeklyMealPlan_v1')).not.toBeNull();
  });

  it('is idempotent — a second load does not re-migrate', () => {
    const storage = seeded();
    const first = load(storage, index);
    save(storage, first);
    first.weeks[0].lunch[1].push({ id: 'porridge' });
    save(storage, first);
    expect(load(storage, index).weeks[0].lunch[1].map(p => p.id)).toEqual(['porridge']);
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
