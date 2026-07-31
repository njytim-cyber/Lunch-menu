import { load, save } from './persistence.js';
import { rollTo, historyOf } from './history.js';
import { weekKey } from './week.js';
import {
  dayIndex, addPlacement, removePlacement, toggleLockAt, isLockedAt,
  clearMealKeepingLocks,
} from './plan.js';
import { FALLBACK_ICON } from '../domain/dishes.js';

/**
 * The single source of truth. The DOM renders from this and never the reverse.
 * Every mutation writes through to storage and notifies subscribers.
 */
export function createStore({ storage, index, now = () => new Date() }) {
  let state = load(storage, index);
  const listeners = new Set();

  // A stored week older than the real current week rolls over on open.
  const thisWeek = weekKey(now());
  if (state.weeks[0]?.weekOf !== thisWeek) {
    state = rollTo(state, thisWeek);
    save(storage, state);
  }

  function commit(next) {
    state = next;
    save(storage, state);
    for (const fn of listeners) fn(state);
  }

  /** Clone-mutate-commit. The draft's weeks[0] is passed to `fn` for convenience. */
  function mutate(fn) {
    const next = structuredClone(state);
    fn(next.weeks[0], next);
    commit(next);
  }

  return {
    getState: () => state,
    currentWeek: () => state.weeks[0],
    history: () => historyOf(state),

    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    /** Manifest dish or user-created custom dish, whichever matches. */
    resolve(dishId) {
      return index.byId.get(dishId) ?? state.custom.find(d => d.id === dishId) ?? null;
    },

    addDish(meal, dayName, dishId) {
      mutate(week => addPlacement(week, meal, dayIndex(dayName), dishId));
    },

    removeDish(meal, dayName, dishId) {
      // The lock lives on the placement, so it leaves with it — no cleanup.
      mutate(week => removePlacement(week, meal, dayIndex(dayName), dishId));
    },

    clearMeal(meal) {
      mutate(week => clearMealKeepingLocks(week, meal));
    },

    setWeek(week) {
      mutate((_, s) => { s.weeks[0] = week; });
    },

    toggleLock(meal, dayName, dishId) {
      mutate(week => toggleLockAt(week, meal, dayIndex(dayName), dishId));
    },

    isLocked(meal, dayName, dishId) {
      return isLockedAt(state.weeks[0], meal, dayIndex(dayName), dishId);
    },

    rollToWeek(nextWeek) {
      commit(rollTo(state, nextWeek));
    },

    setRecipe(dishId, text) {
      mutate((_, s) => { s.recipes[dishId] = text; });
    },

    getRecipe(dishId) {
      return state.recipes[dishId] ?? '';
    },

    addCustomDish({ name, meal, category, prep = 'unknown' }) {
      const id = `custom-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
      const dish = { id, name, meals: [meal], category, prep, icon: FALLBACK_ICON, description: '', isCustom: true };
      mutate((_, s) => {
        if (!s.custom.some(d => d.id === id)) s.custom.push(dish);
      });
      return dish;
    },
  };
}
