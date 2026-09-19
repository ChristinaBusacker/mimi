import type { LocalizationDictionary } from '../../core/i18n/i18n.types';

import { createCountdownViewModel } from './home-countdown';

const dictionary: LocalizationDictionary = {
  'hero.upcoming.countdown.label': 'Noch',
  'hero.upcoming.countdown.starting': 'Startet gleich',
  'hero.upcoming.countdown.day': 'Tag',
  'hero.upcoming.countdown.days': 'Tage',
  'hero.upcoming.countdown.hourShort': 'Std',
};

describe('createCountdownViewModel', () => {
  const now = Date.parse('2026-09-20T12:00:00.000Z');

  it('shows days above 48 hours', () => {
    expect(
      createCountdownViewModel(
        '2026-09-24T12:00:00.000Z',
        now,
        dictionary,
      ),
    ).toEqual({
      label: 'Noch',
      value: '4 Tage',
      accessibleText: 'Noch 4 Tage',
    });
  });

  it('shows days and hours between two and 48 hours', () => {
    expect(
      createCountdownViewModel(
        '2026-09-21T18:00:00.000Z',
        now,
        dictionary,
      ),
    ).toEqual({
      label: 'Noch',
      value: '1 Tag 6 Std',
      accessibleText: 'Noch 1 Tag 6 Std',
    });
  });

  it('shows a digital countdown below two hours', () => {
    expect(
      createCountdownViewModel(
        '2026-09-20T13:42:17.000Z',
        now,
        dictionary,
      ),
    ).toEqual({
      label: 'Noch',
      value: '01:42:17',
      accessibleText: 'Noch 01:42:17',
    });
  });

  it('shows the starting state after the scheduled time', () => {
    expect(
      createCountdownViewModel(
        '2026-09-20T11:59:59.000Z',
        now,
        dictionary,
      ),
    ).toEqual({
      label: '',
      value: 'Startet gleich',
      accessibleText: 'Startet gleich',
    });
  });
});
