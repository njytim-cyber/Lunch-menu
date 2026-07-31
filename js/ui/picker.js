import { escapeHtml } from './escape.js';
import { iconMarkup } from './icons.js';
import { roleOf, ROLE_LABEL } from './roles.js';
import { weeksSince, describeRecency } from '../core/history.js';

/** Manifest dishes for `meal`, plus any custom dishes added for it. */
function dishesFor(meal, state, index) {
  return [...index.forMeal(meal), ...state.custom.filter(d => d.meals.includes(meal))];
}

/**
 * Least-recently-cooked first, with never-cooked dishes at the top.
 * This is the same ordering the generator weights by — exposing it here
 * means a manual edit gets the same "what haven't we had in a while?"
 * information the engine uses.
 */
function byStalest(dishes, lastUsed, weekOf) {
  return [...dishes].sort((a, b) => {
    const ga = weeksSince(lastUsed, a.id, weekOf);
    const gb = weeksSince(lastUsed, b.id, weekOf);
    if (ga !== gb) return gb - ga;
    return a.name.localeCompare(b.name);
  });
}

function optionRow(dish, { meal, day, lastUsed, weekOf, current }) {
  const recency = describeRecency(lastUsed, dish.id, weekOf);
  const fresh = weeksSince(lastUsed, dish.id, weekOf) === Infinity;
  const isCurrent = dish.id === current;

  return `
    <li>
      <button class="option${isCurrent ? ' option--current' : ''}"
              data-action="choose-dish" data-dish="${escapeHtml(dish.id)}"
              data-meal="${meal}" data-day="${day}"
              ${isCurrent ? 'aria-current="true"' : ''}
              data-role="${roleOf(dish, meal)}">
        <span class="option__mark">${iconMarkup(dish.icon)}</span>
        <span class="option__text">
          <span class="option__name">${escapeHtml(dish.name)}</span>
          <span class="option__meta${fresh ? ' option__meta--fresh' : ''}">${recency}</span>
        </span>
      </button>
    </li>`;
}

/**
 * One sheet, two framings.
 *
 * mode 'swap' — opened by tapping a planned dish. Offers same-role
 * alternatives plus pin and remove. Tapping a dish must never delete it
 * outright; in an edit-heavy journey a mis-tap would be the likeliest
 * way to lose work.
 *
 * mode 'add' — opened by the Add control on an empty slot.
 */
export function renderPicker(sheet, {
  mode, meal, day, dishId = null, state, store, index, lastUsed, weekOf, category = null,
}) {
  const current = dishId ? store.resolve(dishId) : null;
  const role = current ? roleOf(current, meal) : null;

  sheet.querySelector('#pickerTitle').textContent =
    mode === 'swap' ? `Change ${current?.name ?? 'dish'}` : `Add to ${meal}`;

  // --- contextual actions, swap only ---
  const actions = sheet.querySelector('#pickerActions');
  if (mode === 'swap' && current) {
    const pinned = store.isLocked(meal, day, dishId);
    actions.hidden = false;
    actions.innerHTML = `
      <button class="btn" data-action="toggle-pin" data-meal="${meal}" data-day="${day}"
              data-dish="${escapeHtml(dishId)}" aria-pressed="${pinned}">
        ${pinned ? 'Unpin' : 'Pin'}
      </button>
      <button class="btn btn--quiet" data-action="remove-dish" data-meal="${meal}"
              data-day="${day}" data-dish="${escapeHtml(dishId)}">Remove</button>`;
  } else {
    actions.hidden = true;
    actions.innerHTML = '';
  }

  // --- filters ---
  const cats = index.categories[meal] ?? [];
  const activeCat = mode === 'swap' && role && role !== 'main' && category === null
    ? null                                  // swap defaults to same-role dishes
    : category;

  sheet.querySelector('#pickerCategories').innerHTML = [
    `<button class="chip${activeCat === null ? ' chip--on' : ''}" data-action="pick-category"
             data-category="">${mode === 'swap' && role !== 'main' ? `Other ${ROLE_LABEL[role]?.toLowerCase() ?? 'dishes'}` : 'All'}</button>`,
    ...cats.map(c => `
      <button class="chip${c === activeCat ? ' chip--on' : ''}" data-action="pick-category"
              data-category="${c}">${c.charAt(0).toUpperCase() + c.slice(1)}</button>`),
  ].join('');

  // --- options ---
  let pool = dishesFor(meal, state, index);
  if (activeCat) {
    pool = pool.filter(d => d.category === activeCat);
  } else if (mode === 'swap' && role && role !== 'main' && role !== 'other') {
    pool = pool.filter(d => roleOf(d, meal) === role);
  }

  const rows = byStalest(pool, lastUsed, weekOf)
    .map(d => optionRow(d, { meal, day, lastUsed, weekOf, current: dishId }))
    .join('');

  sheet.querySelector('#pickerItems').innerHTML =
    rows || '<p class="meal__empty">No dishes in this group yet.</p>';
}

export function openSheet(el, scrim) {
  el.dataset.open = 'true';
  if (scrim) scrim.dataset.open = 'true';
}

export function closeSheet(el, scrim) {
  delete el.dataset.open;
  if (scrim) delete scrim.dataset.open;
}
