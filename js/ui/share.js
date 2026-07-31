import { DAYS } from '../core/week.js';

const DAY_LABEL = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const fmt = (iso) => {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

/** Plain-text week, for the share sheet or clipboard. */
export function weekAsText(week, store) {
  const end = new Date(`${week.weekOf}T00:00:00`);
  end.setDate(end.getDate() + 6);
  const range = `${fmt(week.weekOf)} – ${fmt(end.toISOString().slice(0, 10))}`;

  const body = DAYS.map((_, i) => {
    const names = (meal) => week[meal][i].map(p => store.resolve(p.id)?.name).filter(Boolean);
    const lunch = names('lunch');
    const dinner = names('dinner');
    if (!lunch.length && !dinner.length) return '';

    const lines = [DAY_LABEL[i].toUpperCase()];
    if (lunch.length) lines.push(`Lunch: ${lunch.join(', ')}`);
    if (dinner.length) lines.push(`Dinner: ${dinner.join(', ')}`);
    return lines.join('\n');
  }).filter(Boolean).join('\n\n');

  return `Weekly Meals · ${range}\n\n${body}`;
}

/**
 * Share the week. Uses the native sheet where available and falls back to
 * the clipboard. Returns the outcome so the caller can phrase the toast.
 */
export async function shareWeek(week, store) {
  const text = weekAsText(week, store);

  if (navigator.share) {
    try {
      await navigator.share({ title: 'Weekly Meals', text });
      return 'shared';
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelled';
      // fall through to clipboard
    }
  }

  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}
