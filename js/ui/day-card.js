import { DAYS } from '../core/week.js';
import { iconMarkup } from './icons.js';
import { escapeHtml } from './escape.js';

const label = (day) => day.charAt(0).toUpperCase() + day.slice(1);

function dishMarkup({ dish, meal, day, locked }) {
  const attrs = `data-meal="${meal}" data-day="${day}" data-dish="${escapeHtml(dish.id)}"`;
  const name = escapeHtml(dish.name);
  return `
    <div class="dish${locked ? ' dish--locked' : ''}">
      <button class="dish__body" data-action="dish-tap" ${attrs}
              aria-label="Remove ${name}">
        <span class="dish__icon">${iconMarkup(dish.icon)}</span>
        <span class="dish__name">${name}</span>
      </button>
      <button class="dish__pin" data-action="toggle-pin" ${attrs}
              aria-pressed="${locked}" aria-label="${locked ? 'Unpin' : 'Pin'} ${name}">
        <svg class="dish-icon" aria-hidden="true" focusable="false"><use href="#_pin"/></svg>
      </button>
    </div>`;
}

/**
 * Full re-render of one meal's seven-day grid. Idempotent: the container's
 * contents are replaced, so calling this on every store change is correct
 * and there is no incremental-update path to get out of sync.
 *
 * Lock state comes off the placement itself, so a dish and its pin can
 * never disagree.
 */
export function renderWeek(container, { meal, week, store, todayKey }) {
  container.innerHTML = DAYS.map((day, i) => {
    const items = week[meal][i].map(p => {
      const dish = store.resolve(p.id);
      if (!dish) return '';
      return dishMarkup({ dish, meal, day, locked: Boolean(p.lock) });
    }).join('');

    return `
      <article class="day-card${day === todayKey ? ' day-card--today' : ''}"
               data-day="${day}" data-meal="${meal}">
        <h3 class="day-card__header">${label(day)}</h3>
        <div class="day-card__items">${items}</div>
        <button class="btn btn--add" data-action="open-picker" data-meal="${meal}" data-day="${day}"
                aria-label="Add a dish to ${label(day)}">+</button>
      </article>`;
  }).join('');
}
