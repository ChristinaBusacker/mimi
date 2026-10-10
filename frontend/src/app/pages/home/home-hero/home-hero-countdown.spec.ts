import { createHomeCountdownParts } from './home-hero-countdown';

describe('home hero countdown', () => {
  const now = Date.UTC(2026, 9, 10, 12, 0, 0);

  it('always shows days, hours, minutes and seconds', () => {
    const target = new Date(now + (((2 * 24 + 3) * 60 + 4) * 60 + 5) * 1000);
    expect(createHomeCountdownParts(target.toISOString(), now)).toEqual({
      days: '02',
      hours: '03',
      minutes: '04',
      seconds: '05',
      hasStarted: false,
    });
  });

  it('rounds up the final fractional second', () => {
    const target = new Date(now + 100);
    expect(createHomeCountdownParts(target.toISOString(), now)?.seconds).toBe('01');
  });

  it('does not count into negative time', () => {
    expect(createHomeCountdownParts(new Date(now - 10_000).toISOString(), now)).toEqual({
      days: '00',
      hours: '00',
      minutes: '00',
      seconds: '00',
      hasStarted: true,
    });
  });

  it('rejects invalid dates', () => {
    expect(createHomeCountdownParts('invalid', now)).toBeNull();
  });
});
