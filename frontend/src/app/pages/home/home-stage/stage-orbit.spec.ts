import { nearestStageIndex, nearestStageStop, STAGE_STEP, STAGE_WORLDS } from './stage-orbit';

describe('Stage orbit', () => {
  it('uses a three-stop cyclic orbit', () => {
    expect(STAGE_WORLDS).toEqual(['music', 'community', 'gaming']);
    expect(nearestStageIndex(0)).toBe(0);
    expect(nearestStageIndex(STAGE_STEP)).toBe(1);
    expect(nearestStageIndex(-STAGE_STEP)).toBe(2);
  });

  it('selects the shortest angular path, including across the wrap', () => {
    expect(nearestStageStop(0, 'gaming')).toBeCloseTo(-STAGE_STEP);
    expect(nearestStageStop(0, 'community')).toBeCloseTo(STAGE_STEP);
    expect(nearestStageStop(STAGE_STEP * 2, 'music')).toBeCloseTo(STAGE_STEP * 3);
  });
});
