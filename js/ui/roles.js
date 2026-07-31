/**
 * A dish's structural role in its meal.
 *
 * Dinner has a fixed grammar — staple, vegetable, protein, soup — and the
 * UI renders those roles in that order with a consistent colour, so a
 * week's balance is readable at a glance. Lunch is a single main, so
 * every lunch dish is simply "main".
 *
 * Note `rice` is meal-dependent: at dinner it is the staple beside other
 * dishes; at lunch it IS the dish (Hainanese Chicken Rice, Nasi Lemak).
 */
const DINNER_ROLE = {
  rice: 'staple',
  vegetables: 'veg',
  soup: 'soup',
  fish: 'protein', pork: 'protein', chicken: 'protein',
  eggs: 'protein', prawn: 'protein', tofu: 'protein',
};

const ORDER = { staple: 0, veg: 1, protein: 2, soup: 3, main: 0, other: 4 };

export const ROLE_LABEL = {
  staple: 'Staple', veg: 'Vegetable', protein: 'Protein',
  soup: 'Soup', main: 'Main', other: 'Dish',
};

export function roleOf(dish, meal) {
  if (!dish) return 'other';
  if (meal === 'lunch') return 'main';
  return DINNER_ROLE[dish.category] ?? 'other';
}

/** Sort placements into the meal's grammatical order. */
export function inRoleOrder(placements, meal, resolve) {
  return [...placements].sort((a, b) => {
    const ra = ORDER[roleOf(resolve(a.id), meal)] ?? 9;
    const rb = ORDER[roleOf(resolve(b.id), meal)] ?? 9;
    return ra - rb;
  });
}
