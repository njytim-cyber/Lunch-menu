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
