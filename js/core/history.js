import { weeksBetween } from './week.js';
import { MAX_WEEKS, emptyWeek, isEmpty } from './plan.js';

const MEALS = ['lunch', 'dinner'];

/** Past weeks only — weeks[0] is the week currently being planned. */
export function historyOf(state) {
  return state.weeks.slice(1);
}

/**
 * Map of dish id -> the most recent weekOf in which it appeared.
 *
 * `weeks` must be newest-first, which lets a single pass win: the first
 * time an id is seen is by construction its most recent use, so no date
 * comparison is needed. Built once per generate run, then queried O(1) —
 * the naive alternative rescans every history week per candidate per slot.
 */
export function buildLastUsedIndex(weeks) {
  const index = new Map();
  for (const week of weeks) {
    for (const meal of MEALS) {
      for (const slot of week[meal]) {
        for (const p of slot) {
          if (!index.has(p.id)) index.set(p.id, week.weekOf);
        }
      }
    }
  }
  return index;
}

export function weeksSince(index, dishId, currentWeekKey) {
  const last = index.get(dishId);
  if (last === undefined) return Infinity;
  return weeksBetween(last, currentWeekKey);
}

/**
 * Human phrasing for how long since a dish was last cooked.
 *
 * Surfaced in the swap sheet so the same signal the generator weights by
 * is visible to the person editing, rather than hidden inside the engine.
 */
export function describeRecency(index, dishId, currentWeekKey) {
  const gap = weeksSince(index, dishId, currentWeekKey);
  if (gap === Infinity) return 'Not cooked yet';
  if (gap <= 0) return 'This week';
  if (gap === 1) return 'Last week';
  if (gap >= 12) return '12+ weeks ago';
  return `${gap} weeks ago`;
}

/**
 * Start a new current week. The outgoing week is archived unless it is
 * empty, in which case it is discarded rather than cluttering history.
 * Returns new state; does not mutate.
 */
export function rollTo(state, nextWeekKey) {
  const outgoing = state.weeks[0];
  const kept = outgoing && !isEmpty(outgoing) ? state.weeks : state.weeks.slice(1);
  return { ...state, weeks: [emptyWeek(nextWeekKey), ...kept].slice(0, MAX_WEEKS) };
}

export function findWeek(state, weekOf) {
  return state.weeks.find(w => w.weekOf === weekOf) ?? null;
}
