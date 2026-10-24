import { describe, expect, it } from 'vitest';

import { albumFanWindow } from './album-fan-layout';

describe('albumFanWindow', () => {
  it('handles empty and small catalogs without duplicating covers', () => {
    expect(albumFanWindow(0, 0)).toEqual([]);
    for (const count of [1, 2, 3, 4, 5]) {
      const slots = albumFanWindow(count, 0);
      expect(slots).toHaveLength(count);
      expect(new Set(slots.map((slot) => slot.index)).size).toBe(count);
    }
  });

  it('limits a large catalog to the five nearest albums', () => {
    const slots = albumFanWindow(1000, 123);
    expect(slots.map((slot) => slot.index)).toEqual([121, 122, 123, 124, 125]);
    expect(slots.map((slot) => slot.offset)).toEqual([-2, -1, 0, 1, 2]);
  });

  it('wraps the carousel at either end', () => {
    expect(albumFanWindow(30, 0).map((slot) => slot.index)).toEqual([28, 29, 0, 1, 2]);
    expect(albumFanWindow(30, 29).map((slot) => slot.index)).toEqual([27, 28, 29, 0, 1]);
  });

  it('keeps continuous offsets during dragging and shifts the five-card window', () => {
    const before = albumFanWindow(20, 5, 0.3);
    const after = albumFanWindow(20, 5, 0.8);
    expect(before.map((slot) => slot.index)).toEqual([3, 4, 5, 6, 7]);
    expect(after.map((slot) => slot.index)).toEqual([4, 5, 6, 7, 8]);
    expect(after.find((slot) => slot.index === 5)?.offset).toBeCloseTo(-0.8);
    expect(new Set(after.map((slot) => slot.index)).size).toBe(5);
  });
});
