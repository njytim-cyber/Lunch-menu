import { DAYS } from '../core/week.js';
import { escapeHtml } from './escape.js';
import { roleOf, inRoleOrder } from './roles.js';

const DAY_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const dateOf = (weekOf, i) => {
  const d = new Date(`${weekOf}T00:00:00`);
  d.setDate(d.getDate() + i);
  return d;
};

function dishRow({ dish, meal, day, locked, size }) {
  const role = roleOf(dish, meal);
  const attrs = `data-meal="${meal}" data-day="${day}" data-dish="${escapeHtml(dish.id)}"`;
  const name = escapeHtml(dish.name);
  return `
    <li class="row row--${size}${locked ? ' row--pinned' : ''}" data-role="${role}">
      <button class="row__swap" data-action="open-swap" ${attrs}
              aria-label="Change ${name}">
        <span class="row__mark" aria-hidden="true"></span>
        <span class="row__name">${name}</span>
      </button>
      ${locked ? '<span class="row__pinned" aria-label="Pinned">Pinned</span>' : ''}
    </li>`;
}

function mealBlock({ week, i, meal, store, size, label }) {
  const placements = inRoleOrder(week[meal][i], meal, id => store.resolve(id));
  const day = DAYS[i];

  const rows = placements.map(p => {
    const dish = store.resolve(p.id);
    return dish ? dishRow({ dish, meal, day, locked: Boolean(p.lock), size }) : '';
  }).join('');

  return `
    <div class="meal">
      <div class="meal__head">
        <h3 class="eyebrow">${label}</h3>
        <button class="meal__add" data-action="open-picker" data-meal="${meal}" data-day="${day}"
                aria-label="Add a dish to ${label.toLowerCase()} on ${DAY_FULL[i]}">Add</button>
      </div>
      ${rows ? `<ul class="meal__list">${rows}</ul>` : '<p class="meal__empty">Nothing planned</p>'}
    </div>`;
}

/** The one card that answers "what am I cooking today?". */
export function renderToday(container, { week, store, todayIndex }) {
  const d = dateOf(week.weekOf, todayIndex);
  const dateLabel = d.toLocaleDateString(undefined, { day: 'numeric', month: 'long' });

  container.innerHTML = `
    <article class="today">
      <header class="today__head">
        <p class="eyebrow eyebrow--accent">Today</p>
        <h2 class="today__day">${DAY_FULL[todayIndex]}</h2>
        <p class="today__date">${escapeHtml(dateLabel)}</p>
      </header>
      <div class="today__meals">
        ${mealBlock({ week, i: todayIndex, meal: 'lunch',  store, size: 'lg', label: 'Lunch' })}
        ${mealBlock({ week, i: todayIndex, meal: 'dinner', store, size: 'lg', label: 'Dinner' })}
      </div>
    </article>`;
}

/** The remaining six days, in calendar order, today omitted. */
export function renderWeekGrid(container, { week, store, todayIndex }) {
  container.innerHTML = DAYS.map((_, i) => {
    if (i === todayIndex) return '';
    const past = i < todayIndex;
    const d = dateOf(week.weekOf, i);

    return `
      <article class="day${past ? ' day--past' : ''}" data-day="${DAYS[i]}">
        <header class="day__head">
          <h3 class="day__name">${DAY_SHORT[i]}</h3>
          <span class="day__date">${d.getDate()}</span>
        </header>
        ${mealBlock({ week, i, meal: 'lunch',  store, size: 'sm', label: 'Lunch' })}
        ${mealBlock({ week, i, meal: 'dinner', store, size: 'sm', label: 'Dinner' })}
      </article>`;
  }).join('');
}
