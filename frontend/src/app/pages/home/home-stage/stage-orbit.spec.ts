import { isStageCarouselMoving, nearestStageIndex, nearestStageStop, STAGE_STEP, STAGE_WORLDS } from './stage-orbit';

describe('Stage orbit', () => {
  it('uses a three-stop cyclic orbit', () => {
    expect(STAGE_WORLDS).toEqual(['music', 'community', 'gaming']);
    expect(nearestStageIndex(0)).toBe(0);
    expect(nearestStageIndex(STAGE_STEP)).toBe(1);
    expect(nearestStageIndex(-STAGE_STEP)).toBe(2);
  });

  it('shows the spotlight when the orbit settles, even if pointer parallax is still active', () => {
    expect(isStageCarouselMoving(false, 0, 0)).toBe(false);
    expect(isStageCarouselMoving(true, 0, 0)).toBe(true);
    expect(isStageCarouselMoving(false, 0.02, 0)).toBe(true);
    expect(isStageCarouselMoving(false, 0, 0.03)).toBe(true);
  });

  it('selects the shortest angular path, including across the wrap', () => {
    expect(nearestStageStop(0, 'gaming')).toBeCloseTo(-STAGE_STEP);
    expect(nearestStageStop(0, 'community')).toBeCloseTo(STAGE_STEP);
    expect(nearestStageStop(STAGE_STEP * 2, 'music')).toBeCloseTo(STAGE_STEP * 3);
  });
});
