import { DAYS } from '../core/week.js';
import { escapeHtml } from './escape.js';

const pretty = (key) => {
  const d = new Date(`${key}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? key
    : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

/** Read-only list of past weeks, each with a "copy to this week" action. */
export function renderHistory(container, { store }) {
  const history = store.history();

  if (history.length === 0) {
    container.innerHTML =
      '<p class="empty">No past weeks yet. This week is archived automatically when the next one starts.</p>';
    return;
  }

  container.innerHTML = history.map(week => {
    const summary = DAYS.map((day, i) => {
      const names = [...week.lunch[i], ...week.dinner[i]]
        .map(p => store.resolve(p.id)?.name)
        .filter(Boolean);
      return names.length
        ? `<li><strong>${day.slice(0, 3)}</strong>${escapeHtml(names.join(', '))}</li>`
        : '';
    }).join('');

    return `
      <section class="history-week">
        <header>
          <h3>Week of ${escapeHtml(pretty(week.weekOf))}</h3>
          <button class="btn" data-action="copy-week" data-week="${escapeHtml(week.weekOf)}">Copy to this week</button>
        </header>
        <ul class="history-week__days">${summary}</ul>
      </section>`;
  }).join('');
}
