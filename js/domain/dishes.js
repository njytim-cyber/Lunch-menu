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
