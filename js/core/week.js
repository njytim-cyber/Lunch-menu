export const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

/** Midnight on the Monday of the week containing `date`. */
export function mondayOf(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay();                    // 0=Sun .. 6=Sat
  const shift = dow === 0 ? -6 : 1 - dow;    // Sunday belongs to the week that began 6 days ago
  d.setDate(d.getDate() + shift);
  return d;
}

/** "YYYY-MM-DD" for the Monday of the week containing `date`. */
export function weekKey(date = new Date()) {
  const m = mondayOf(date);
  const yyyy = m.getFullYear();
  const mm = String(m.getMonth() + 1).padStart(2, '0');
  const dd = String(m.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Whole weeks from `aKey` to `bKey`. Both are Monday keys.
 * Uses UTC parsing so a daylight-saving transition inside the range
 * cannot round the division to the wrong integer.
 */
export function weeksBetween(aKey, bKey) {
  const a = Date.parse(`${aKey}T00:00:00Z`);
  const b = Date.parse(`${bKey}T00:00:00Z`);
  return Math.round((b - a) / (7 * 24 * 60 * 60 * 1000));
}
