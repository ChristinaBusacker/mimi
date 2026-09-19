import type { LocalizationDictionary } from '../../core/i18n/i18n.types';

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const SECOND_MS = 1000;

export interface CountdownViewModel {
  label: string;
  value: string;
  accessibleText: string;
}

export function createCountdownViewModel(
  startsAt: string,
  now: number,
  dictionary: LocalizationDictionary,
): CountdownViewModel | null {
  const startTime = Date.parse(startsAt);

  if (!Number.isFinite(startTime)) {
    return null;
  }

  const remaining = Math.max(startTime - now, 0);

  if (remaining === 0) {
    const value = translate(
      dictionary,
      'hero.upcoming.countdown.starting',
    );

    return {
      label: '',
      value,
      accessibleText: value,
    };
  }

  const label = translate(
    dictionary,
    'hero.upcoming.countdown.label',
  );

  let value: string;

  if (remaining > FORTY_EIGHT_HOURS_MS) {
    const days = Math.ceil(remaining / DAY_MS);

    value = `${days} ${translate(
      dictionary,
      days === 1
        ? 'hero.upcoming.countdown.day'
        : 'hero.upcoming.countdown.days',
    )}`;
  } else if (remaining >= TWO_HOURS_MS) {
    const days = Math.floor(remaining / DAY_MS);
    const hours = Math.floor(
      (remaining % DAY_MS) / HOUR_MS,
    );

    const parts: string[] = [];

    if (days > 0) {
      parts.push(
        `${days} ${translate(
          dictionary,
          days === 1
            ? 'hero.upcoming.countdown.day'
            : 'hero.upcoming.countdown.days',
        )}`,
      );
    }

    if (hours > 0 || days === 0) {
      parts.push(
        `${hours} ${translate(
          dictionary,
          'hero.upcoming.countdown.hourShort',
        )}`,
      );
    }

    value = parts.join(' · ');
  } else {
    const totalSeconds = Math.ceil(remaining / SECOND_MS);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    value = [hours, minutes, seconds]
      .map((part) => String(part).padStart(2, '0'))
      .join(':');
  }

  return {
    label,
    value,
    accessibleText: `${label} ${value}`,
  };
}

function translate(
  dictionary: LocalizationDictionary,
  key: string,
): string {
  return dictionary[key] ?? key;
}
