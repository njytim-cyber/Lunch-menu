import { iconMarkup } from './icons.js';
import { escapeHtml } from './escape.js';

const title = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Manifest dishes for `meal`, plus any custom dishes the user added for it. */
function dishesFor(meal, state, index) {
  return [...index.forMeal(meal), ...state.custom.filter(d => d.meals.includes(meal))];
}

export function renderPicker(sheet, { meal, day, state, store, index, category = null }) {
  const cats = index.categories[meal] ?? [];

  sheet.querySelector('#pickerCategories').innerHTML = [
    `<button class="btn btn--chip${category === null ? ' btn--chip-active' : ''}"
             data-action="pick-category" data-category="" data-meal="${meal}" data-day="${day}">All</button>`,
    ...cats.map(c => `
      <button class="btn btn--chip${c === category ? ' btn--chip-active' : ''}"
              data-action="pick-category" data-category="${c}" data-meal="${meal}" data-day="${day}">
        ${title(c)}
      </button>`),
  ].join('');

  const items = dishesFor(meal, state, index)
    .filter(d => !category || d.category === category)
    .sort((a, b) => a.name.localeCompare(b.name));

  sheet.querySelector('#pickerItems').innerHTML = items.map(d => `
    <button class="dish" data-action="add-dish"
            data-dish="${escapeHtml(d.id)}" data-meal="${meal}" data-day="${day}">
      <span class="dish__body">
        <span class="dish__icon">${iconMarkup(d.icon)}</span>
        <span class="dish__name">${escapeHtml(d.name)}</span>
      </span>
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
