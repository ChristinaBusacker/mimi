export const DEFAULT_COMMUNITY_TIME_ZONE =
  'Europe/Berlin';

export function createCommunityDateFormatter(
  timeZone: string,
): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat(
      'en-CA',
      {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      },
    );
  } catch {
    throw new Error(
      `COMMUNITY_TIME_ZONE "${timeZone}" is not a valid IANA time zone.`,
    );
  }
}

export function formatCommunityDate(
  formatter: Intl.DateTimeFormat,
  date: Date,
): string {
  const parts =
    formatter.formatToParts(date);
  const part = (
    type: Intl.DateTimeFormatPartTypes,
  ): string =>
    parts.find(
      (candidate) =>
        candidate.type === type,
    )?.value ?? '';

  return [
    part('year'),
    part('month'),
    part('day'),
  ].join('-');
}
