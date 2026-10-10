import { advanceStageParallax } from './stage-parallax';

describe('Stage parallax spring', () => {
  it('converges to a small target without jumping on the first frame', () => {
    const position = { x: 0, y: 0 };
    const velocity = { x: 0, y: 0 };
    const target = { x: 0.04, y: -0.02 };
    advanceStageParallax(position, velocity, target, 1 / 60);
    expect(position.x).toBeGreaterThan(0);
    expect(position.x).toBeLessThan(target.x);
    for (let i = 0; i < 300; i++) advanceStageParallax(position, velocity, target, 1 / 60);
    expect(position.x).toBeCloseTo(target.x, 4);
    expect(position.y).toBeCloseTo(target.y, 4);
  });

  it('settles back to zero after movement is released', () => {
    const position = { x: 0.05, y: -0.03 };
    const velocity = { x: 0, y: 0 };
    for (let i = 0; i < 350; i++) advanceStageParallax(position, velocity, { x: 0, y: 0 }, 1 / 60);
    expect(position).toEqual({ x: 0, y: 0 });
    expect(velocity).toEqual({ x: 0, y: 0 });
  });
});
