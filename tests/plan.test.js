import { describe, it, expect } from 'vitest';
import {
  MAX_WEEKS, emptyWeek, dayIndex, slotOf, idsIn, isEmpty,
  addPlacement, removePlacement, toggleLockAt, isLockedAt,
  lockedPlacements, clearMealKeepingLocks,
} from '../js/core/plan.js';

describe('emptyWeek', () => {
  it('creates exactly seven slots per meal', () => {
    const w = emptyWeek('2026-07-27');
    expect(w.lunch).toHaveLength(7);
    expect(w.dinner).toHaveLength(7);
  });

  it('starts every slot empty and independent', () => {
    const w = emptyWeek('2026-07-27');
    w.lunch[0].push({ id: 'bee-hoon' });
    expect(w.lunch[1]).toHaveLength(0);
  });

  it('records the week key', () => {
    expect(emptyWeek('2026-07-27').weekOf).toBe('2026-07-27');
  });
});

describe('dayIndex', () => {
  it('maps Monday to 0 and Sunday to 6', () => {
    expect(dayIndex('monday')).toBe(0);
    expect(dayIndex('sunday')).toBe(6);
  });
});

describe('placements', () => {
  it('adds a dish', () => {
    const w = emptyWeek('2026-07-27');
    addPlacement(w, 'lunch', 0, 'bee-hoon');
    expect(slotOf(w, 'lunch', 0)).toEqual([{ id: 'bee-hoon' }]);
  });

  it('does not add the same dish twice to one slot', () => {
    const w = emptyWeek('2026-07-27');
    addPlacement(w, 'lunch', 0, 'bee-hoon');
    addPlacement(w, 'lunch', 0, 'bee-hoon');
    expect(slotOf(w, 'lunch', 0)).toHaveLength(1);
  });

  it('removes a dish', () => {
    const w = emptyWeek('2026-07-27');
    addPlacement(w, 'dinner', 2, 'rice');
    addPlacement(w, 'dinner', 2, 'kai-lan');
    removePlacement(w, 'dinner', 2, 'rice');
    expect(slotOf(w, 'dinner', 2)).toEqual([{ id: 'kai-lan' }]);
  });

  it('takes the lock with the placement when removed', () => {
    const w = emptyWeek('2026-07-27');
    addPlacement(w, 'lunch', 0, 'bee-hoon');
    toggleLockAt(w, 'lunch', 0, 'bee-hoon');
    removePlacement(w, 'lunch', 0, 'bee-hoon');
    expect(isLockedAt(w, 'lunch', 0, 'bee-hoon')).toBe(false);
  });
});

describe('locks', () => {
  it('toggles on and off', () => {
    const w = emptyWeek('2026-07-27');
    addPlacement(w, 'lunch', 0, 'bee-hoon');
    expect(toggleLockAt(w, 'lunch', 0, 'bee-hoon')).toBe(true);
    expect(isLockedAt(w, 'lunch', 0, 'bee-hoon')).toBe(true);
    expect(toggleLockAt(w, 'lunch', 0, 'bee-hoon')).toBe(false);
    expect(isLockedAt(w, 'lunch', 0, 'bee-hoon')).toBe(false);
  });

  it('is a no-op for a dish that is not placed', () => {
    const w = emptyWeek('2026-07-27');
    expect(toggleLockAt(w, 'lunch', 0, 'ghost')).toBe(false);
  });

  it('collects locked placements as seven slot arrays', () => {
    const w = emptyWeek('2026-07-27');
    addPlacement(w, 'dinner', 3, 'curry-chicken');
    addPlacement(w, 'dinner', 3, 'rice');
    toggleLockAt(w, 'dinner', 3, 'curry-chicken');
    const locked = lockedPlacements(w, 'dinner');
    expect(locked).toHaveLength(7);
    expect(locked[3]).toEqual([{ id: 'curry-chicken', lock: true }]);
    expect(locked[0]).toEqual([]);
  });
});

describe('clearMealKeepingLocks', () => {
  it('drops unlocked placements and keeps locked ones', () => {
    const w = emptyWeek('2026-07-27');
    addPlacement(w, 'lunch', 0, 'bee-hoon');
    addPlacement(w, 'lunch', 1, 'porridge');
    toggleLockAt(w, 'lunch', 1, 'porridge');
    clearMealKeepingLocks(w, 'lunch');
    expect(slotOf(w, 'lunch', 0)).toEqual([]);
    expect(slotOf(w, 'lunch', 1)).toEqual([{ id: 'porridge', lock: true }]);
  });

  it('leaves the other meal untouched', () => {
    const w = emptyWeek('2026-07-27');
    addPlacement(w, 'dinner', 0, 'rice');
    clearMealKeepingLocks(w, 'lunch');
    expect(slotOf(w, 'dinner', 0)).toEqual([{ id: 'rice' }]);
  });
});

describe('idsIn and isEmpty', () => {
  it('collects every id across both meals', () => {
    const w = emptyWeek('2026-07-27');
    addPlacement(w, 'lunch', 0, 'bee-hoon');
    addPlacement(w, 'dinner', 4, 'rice');
    expect(idsIn(w)).toEqual(new Set(['bee-hoon', 'rice']));
  });

  it('reports an untouched week as empty', () => {
    expect(isEmpty(emptyWeek('2026-07-27'))).toBe(true);
  });

  it('reports a week with any placement as not empty', () => {
    const w = emptyWeek('2026-07-27');
    addPlacement(w, 'lunch', 6, 'porridge');
    expect(isEmpty(w)).toBe(false);
  });
});

describe('MAX_WEEKS', () => {
  it('allows the current week plus twelve of history', () => {
    expect(MAX_WEEKS).toBe(13);
  });
});
