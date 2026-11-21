import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserTimeZone } from './browser-time-zone';

describe('BrowserTimeZone', () => {
  const mockTimeZone = (timeZone: string) =>
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
      ...new Intl.DateTimeFormat('en').resolvedOptions(),
      timeZone,
    });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('detects the IANA zone reported by the browser', () => {
    mockTimeZone('Pacific/Auckland');
    expect(TestBed.inject(BrowserTimeZone).timeZone).toBe('Pacific/Auckland');
  });

  it.each(['', 'Invalid/Zone', '+09:00'])('falls back to UTC for "%s"', (timeZone) => {
    mockTimeZone(timeZone);
    expect(TestBed.inject(BrowserTimeZone).timeZone).toBe('UTC');
  });

  it.each([
    ['America/New_York', '2027-01-01T05:00:00Z'],
    ['America/Argentina/Buenos_Aires', '2027-01-01T03:00:00Z'],
    ['Europe/Madrid', '2026-12-31T23:00:00Z'],
    ['Asia/Tokyo', '2026-12-31T15:00:00Z'],
    ['Pacific/Kiritimati', '2026-12-31T10:00:00Z'],
    ['UTC', '2027-01-01T00:00:00Z'],
    ['America/Santiago', '2024-09-08T04:00:00Z'],
    ['Invalid/Zone', '2027-01-01T00:00:00Z'],
  ])('emits at the local date boundary for %s with one timer', (timeZone, boundary) => {
    mockTimeZone(timeZone);
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(Date.parse(boundary) - 60_000);
    vi.spyOn(TestBed.inject(DOCUMENT), 'hidden', 'get').mockReturnValue(false);

    const onDay = vi.fn();
    const subscription = TestBed.inject(BrowserTimeZone).dayChanges().subscribe(onDay);
    expect(onDay).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(59_999);
    expect(onDay).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(onDay).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(1);
    subscription.unsubscribe();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([
    ['2027-03-27T23:00:00Z', 23, '2027-03-29'],
    ['2027-10-30T22:00:00Z', 25, '2027-11-01'],
  ])('follows the Madrid day starting at %s when it lasts %i hours', (start, dayHours, nextDay) => {
    mockTimeZone('Europe/Madrid');
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(Date.parse(start));
    vi.spyOn(TestBed.inject(DOCUMENT), 'hidden', 'get').mockReturnValue(false);

    const onDay = vi.fn();
    const subscription = TestBed.inject(BrowserTimeZone).dayChanges().subscribe(onDay);
    vi.advanceTimersByTime(dayHours * 60 * 60 * 1000 - 1);
    expect(onDay).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(1);
    expect(onDay).toHaveBeenCalledTimes(2);
    expect(onDay).toHaveBeenLastCalledWith(nextDay);
    subscription.unsubscribe();
    expect(vi.getTimerCount()).toBe(0);
  });
});
