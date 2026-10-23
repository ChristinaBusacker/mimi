import { defaultPageTheme, pageThemeVars, parsePageTheme } from './page-theme';

describe('Composer page themes', () => {
  it('resolves only registered font IDs to CSS and scopes them as variables', () => {
    const vars = pageThemeVars({ fontHeading: 'emilys-candy', colors: { heading: '#fff4faff' } });
    expect(vars['--pc-theme-font-heading']).toContain('EmilysCandy');
    expect(vars['--pc-theme-color-heading']).toBe('#fff4faff');
    expect(pageThemeVars(undefined)).toEqual({});
  });

  it('keeps tablet and mobile font-size overrides', () => {
    const theme = { ...defaultPageTheme(), responsive: { tablet: { h1: 40 }, mobile: { h1: 28 } } };
    const vars = pageThemeVars(parsePageTheme(theme));
    expect(vars['--pc-theme-size-h1']).toBe('48px');
    expect(vars['--pc-theme-tablet-size-h1']).toBe('40px');
    expect(vars['--pc-theme-mobile-size-h1']).toBe('28px');
  });

  it('disallows arbitrary CSS and unavailable font IDs', () => {
    expect(() => parsePageTheme({ fontBody: 'url(javascript:bad)' })).toThrow();
    expect(() => parsePageTheme({ fonts: 'Comic Sans' })).toThrow();
    expect(() => parsePageTheme({ sizes: { body: 1000 } })).toThrow();
  });
});
