/** The visible carousel window is bounded even when the music catalog grows indefinitely. */
export interface AlbumFanSlot {
  index: number;
  /** Continuous signed offset from the active cover, including drag displacement. */
  offset: number;
}

export function albumFanWindow(
  count: number,
  activeIndex: number,
  dragProgress = 0,
): AlbumFanSlot[] {
  if (!Number.isInteger(count) || count < 1) return [];

  const windowSize = Math.min(count, 5);
  const left = Math.floor((windowSize - 1) / 2);
  const center = Math.round(activeIndex + dragProgress);
  const position = activeIndex + dragProgress;
  const slots: AlbumFanSlot[] = [];

  for (let slot = 0; slot < windowSize; slot++) {
    const virtualIndex = center + slot - left;
    slots.push({
      index: ((virtualIndex % count) + count) % count,
      offset: virtualIndex - position,
    });
  }

  return slots;
}
