import { albumDiveTransform } from './album-dive.service';

describe('Album artwork dive', () => {
  it('moves the center of the clicked cover to the viewport center', () => {
    const bounds = { left: 90, top: 210, width: 180, height: 180 };
    const target = albumDiveTransform(bounds, 1280, 720);
    expect(bounds.left + bounds.width / 2 + target.x).toBe(640);
    expect(bounds.top + bounds.height / 2 + target.y).toBe(360);
  });

  it('overscales the artwork so none of its edges remain visible', () => {
    const bounds = { left: 20, top: 60, width: 170, height: 170 };
    const target = albumDiveTransform(bounds, 390, 844);
    expect(bounds.width * target.scale).toBeGreaterThan(390);
    expect(bounds.height * target.scale).toBeGreaterThan(844);
  });
});
