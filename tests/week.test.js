import { describe, it, expect } from 'vitest';
import { mondayOf, weekKey, weeksBetween, DAYS } from '../js/core/week.js';

describe('mondayOf', () => {
  it('returns the same day for a Monday', () => {
    expect(weekKey(new Date('2026-07-27T12:00:00'))).toBe('2026-07-27');
  });

  it('walks back to Monday from mid-week', () => {
    expect(weekKey(new Date('2026-07-30T23:59:00'))).toBe('2026-07-27');
  });

  it('treats Sunday as belonging to the week that started six days earlier', () => {
    expect(weekKey(new Date('2026-08-02T09:00:00'))).toBe('2026-07-27');
  });

  it('crosses a month boundary', () => {
    expect(weekKey(new Date('2026-08-01T09:00:00'))).toBe('2026-07-27');
  });

  it('zeroes the time component', () => {
    const m = mondayOf(new Date('2026-07-30T23:59:00'));
    expect(m.getHours()).toBe(0);
    expect(m.getMinutes()).toBe(0);
  });
});

describe('weeksBetween', () => {
  it('counts forward', () => {
    expect(weeksBetween('2026-07-06', '2026-07-27')).toBe(3);
  });

  it('is zero for the same week', () => {
    expect(weeksBetween('2026-07-27', '2026-07-27')).toBe(0);
  });

  it('is negative when the second key precedes the first', () => {
    expect(weeksBetween('2026-07-27', '2026-07-06')).toBe(-3);
  });

  it('is unaffected by a DST shift', () => {
    expect(weeksBetween('2026-03-02', '2026-03-30')).toBe(4);
  });
});

describe('DAYS', () => {
  it('starts on Monday and has seven entries', () => {
    expect(DAYS).toHaveLength(7);
    expect(DAYS[0]).toBe('monday');
    expect(DAYS[6]).toBe('sunday');
  });
});
