import { describe, it, expect } from 'vitest';
import { emptyWeek, addPlacement, MAX_WEEKS } from '../js/core/plan.js';
import { historyOf, buildLastUsedIndex, weeksSince, rollTo, findWeek } from '../js/core/history.js';

const weekWith = (weekOf, lunchMon = [], dinnerMon = []) => {
  const w = emptyWeek(weekOf);
  for (const id of lunchMon) addPlacement(w, 'lunch', 0, id);
  for (const id of dinnerMon) addPlacement(w, 'dinner', 0, id);
  return w;
};

const stateWith = (...weeks) => ({ version: 3, weeks, custom: [], recipes: {} });

describe('historyOf', () => {
  it('excludes the current week', () => {
    const s = stateWith(weekWith('2026-07-27'), weekWith('2026-07-20'));
    expect(historyOf(s).map(w => w.weekOf)).toEqual(['2026-07-20']);
  });

  it('is empty when only the current week exists', () => {
    expect(historyOf(stateWith(weekWith('2026-07-27')))).toEqual([]);
  });
});

describe('buildLastUsedIndex', () => {
  it('records the most recent week for each dish', () => {
    const idx = buildLastUsedIndex([weekWith('2026-07-20', ['bee-hoon']), weekWith('2026-07-06', ['porridge'])]);
    expect(idx.get('bee-hoon')).toBe('2026-07-20');
    expect(idx.get('porridge')).toBe('2026-07-06');
  });

  it('keeps the newest when a dish appears in several weeks', () => {
    const idx = buildLastUsedIndex([weekWith('2026-07-20', ['porridge']), weekWith('2026-07-06', ['porridge'])]);
    expect(idx.get('porridge')).toBe('2026-07-20');
  });

  it('covers both meals', () => {
    const idx = buildLastUsedIndex([weekWith('2026-07-20', ['bee-hoon'], ['rice'])]);
    expect(idx.get('rice')).toBe('2026-07-20');
  });

  it('omits dishes never used', () => {
    expect(buildLastUsedIndex([weekWith('2026-07-20')]).has('fried-rice')).toBe(false);
  });
});

describe('weeksSince', () => {
  const idx = buildLastUsedIndex([weekWith('2026-07-20', ['bee-hoon']), weekWith('2026-07-06', ['porridge'])]);

  it('returns Infinity for a dish never used', () => {
    expect(weeksSince(idx, 'fried-rice', '2026-07-27')).toBe(Infinity);
  });

  it('measures one week back', () => {
    expect(weeksSince(idx, 'bee-hoon', '2026-07-27')).toBe(1);
  });

  it('measures three weeks back', () => {
    expect(weeksSince(idx, 'porridge', '2026-07-27')).toBe(3);
  });
});

describe('rollTo', () => {
  it('puts a fresh empty week at the front', () => {
    const next = rollTo(stateWith(weekWith('2026-07-27', ['bee-hoon'])), '2026-08-03');
    expect(next.weeks[0].weekOf).toBe('2026-08-03');
    expect(next.weeks[0].lunch[0]).toEqual([]);
  });

  it('pushes the old current week into history intact', () => {
    const next = rollTo(stateWith(weekWith('2026-07-27', ['bee-hoon'])), '2026-08-03');
    expect(next.weeks[1].weekOf).toBe('2026-07-27');
    expect(next.weeks[1].lunch[0]).toEqual([{ id: 'bee-hoon' }]);
  });

  it('discards an empty current week rather than archiving it', () => {
    const next = rollTo(stateWith(weekWith('2026-07-27')), '2026-08-03');
    expect(next.weeks).toHaveLength(1);
  });

  it('trims to MAX_WEEKS', () => {
    let s = stateWith(weekWith('2026-01-05', ['bee-hoon']));
    for (let i = 1; i < 30; i++) {
      s = rollTo(s, `2026-W${i}`);
      s.weeks[0].lunch[0].push({ id: 'bee-hoon' });   // keep each week non-empty
    }
    expect(s.weeks.length).toBeLessThanOrEqual(MAX_WEEKS);
  });

  it('does not mutate the input state', () => {
    const s = stateWith(weekWith('2026-07-27', ['bee-hoon']));
    rollTo(s, '2026-08-03');
    expect(s.weeks).toHaveLength(1);
  });
});

describe('findWeek', () => {
  it('finds a week by key', () => {
    const s = stateWith(weekWith('2026-07-27'), weekWith('2026-07-20'));
    expect(findWeek(s, '2026-07-20').weekOf).toBe('2026-07-20');
  });

  it('returns null when absent', () => {
    expect(findWeek(stateWith(weekWith('2026-07-27')), '2026-01-05')).toBeNull();
  });
});
