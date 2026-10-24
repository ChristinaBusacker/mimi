import { MIMI_FONT_SIZE_STEPS, nextMimiFontSize } from './font-size.extension';

describe('Markup font size', () => {
  it('starts at the inherited size, increases and returns to inherited with a smaller step', () => {
    expect(nextMimiFontSize(100, 'larger')).toBe(115);
    expect(nextMimiFontSize(115, 'smaller')).toBe(100);
  });
  it('clamps font size to configured safe bounds', () => {
    expect(nextMimiFontSize(75, 'smaller')).toBe(75);
    expect(nextMimiFontSize(300, 'larger')).toBe(300);
    expect(MIMI_FONT_SIZE_STEPS).toContain(150);
  });
});
