import { describe, expect, it } from 'vitest';
import { periodToTime } from './periodToTime';

describe('periodToTime', () => {
  it('covers periods 1 through 7 in order', () => {
    expect(periodToTime.map(p => p.period)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('has non-overlapping, chronologically increasing time ranges', () => {
    for (const { start, end } of periodToTime) {
      expect(start < end).toBe(true);
    }
    for (let i = 1; i < periodToTime.length; i++) {
      const previous = periodToTime[i - 1]!;
      const current = periodToTime[i]!;
      expect(previous.end <= current.start).toBe(true);
    }
  });

  it('uses zero-padded HH:MM format', () => {
    for (const { start, end } of periodToTime) {
      expect(start).toMatch(/^\d{2}:\d{2}$/);
      expect(end).toMatch(/^\d{2}:\d{2}$/);
    }
  });
});
