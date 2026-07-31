import { DAYS } from './week.js';

/** Current week plus twelve of history. */
export const MAX_WEEKS = 13;

const MEALS = ['lunch', 'dinner'];

export function emptyWeek(weekOf) {
  return {
    weekOf,
    lunch:  Array.from({ length: 7 }, () => []),
    dinner: Array.from({ length: 7 }, () => []),
  };
}

export function dayIndex(dayName) {
  return DAYS.indexOf(dayName);
}

export function slotOf(week, meal, dayIdx) {
  return week[meal][dayIdx];
}

export function idsIn(week) {
  const ids = new Set();
  for (const meal of MEALS) {
    for (const slot of week[meal]) {
      for (const p of slot) ids.add(p.id);
    }
  }
  return ids;
}

export function isEmpty(week) {
  return MEALS.every(meal => week[meal].every(slot => slot.length === 0));
}

/** Mutates `week`. No-op when the dish is already in that slot. */
export function addPlacement(week, meal, dayIdx, dishId) {
  const slot = week[meal][dayIdx];
  if (!slot.some(p => p.id === dishId)) slot.push({ id: dishId });
}

/** Mutates `week`. The lock, living on the placement, goes with it. */
export function removePlacement(week, meal, dayIdx, dishId) {
  week[meal][dayIdx] = week[meal][dayIdx].filter(p => p.id !== dishId);
}

/** Mutates `week`. Returns the resulting lock state; false if not placed. */
export function toggleLockAt(week, meal, dayIdx, dishId) {
  const p = week[meal][dayIdx].find(x => x.id === dishId);
  if (!p) return false;
  if (p.lock) { delete p.lock; return false; }
  p.lock = true;
  return true;
}

export function isLockedAt(week, meal, dayIdx, dishId) {
  return Boolean(week[meal][dayIdx].find(p => p.id === dishId)?.lock);
}

/** Seven slot arrays containing only the locked placements. */
export function lockedPlacements(week, meal) {
  return week[meal].map(slot => slot.filter(p => p.lock));
}

/**
 * Mutates `week`. Drops unlocked placements and keeps pinned ones —
 * "clear everything except what I pinned".
 */
export function clearMealKeepingLocks(week, meal) {
  week[meal] = week[meal].map(slot => slot.filter(p => p.lock));
}
