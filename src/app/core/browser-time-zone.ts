import { DOCUMENT, inject, Injectable } from '@angular/core';
import {
  distinctUntilChanged,
  EMPTY,
  fromEvent,
  merge,
  Observable,
  of,
  startWith,
  switchMap,
  take,
  timer,
} from 'rxjs';

function detectTimeZone(): string {
  try {
    const timeZone = new Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timeZone && !/^[+-]/.test(timeZone)) {
      return new Intl.DateTimeFormat('en', { timeZone }).resolvedOptions().timeZone;
    }
  } catch {
    // Intl can be unavailable or reject the device's time zone.
  }
  return 'UTC';
}

const hours = 60 * 60 * 1000;
const minute = 60 * 1000;

@Injectable({ providedIn: 'root' })
export class BrowserTimeZone {
  private readonly document = inject(DOCUMENT);
  readonly timeZone = detectTimeZone();
  private readonly formatter =
    this.timeZone === 'UTC'
      ? null
      : new Intl.DateTimeFormat('en', {
          timeZone: this.timeZone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        });
  private readonly visibilityChanges = merge(
    fromEvent(this.document, 'visibilitychange'),
    this.document.defaultView ? fromEvent(this.document.defaultView, 'pageshow') : EMPTY,
  );

  dayChanges(): Observable<string> {
    return new Observable<string>((subscriber) => {
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const checkDay = () => {
        clearTimeout(timeout);
        const now = Date.now();
        const day = this.dayAt(now);
        subscriber.next(day);
        if (this.document.hidden || subscriber.closed) return;

        // Find the local date boundary even when a clock transition skips midnight.
        const nextDay = this.findDayChange(now, now + 48 * hours);
        timeout = setTimeout(checkDay, Math.max(1, nextDay - Date.now()));
      };
      const visibility = this.visibilityChanges.subscribe(() => {
        if (this.document.hidden) clearTimeout(timeout);
        else checkDay();
      });

      checkDay();
      return () => {
        clearTimeout(timeout);
        visibility.unsubscribe();
      };
    }).pipe(distinctUntilChanged());
  }

  midnightRecheckTimes(): readonly number[] {
    const now = Date.now();
    const start = now - 2 * minute;
    if (this.dayAt(start) === this.dayAt(now)) return [];
    const midnight = this.findDayChange(start, now);
    return [midnight + minute, midnight + 2 * minute];
  }

  whenVisibleAt(time: number): Observable<unknown> {
    return this.visibilityChanges.pipe(
      startWith(null),
      switchMap(() => {
        if (this.document.hidden) return EMPTY;
        const delay = time - Date.now();
        return delay > 0 ? timer(delay) : of(null);
      }),
      take(1),
    );
  }

  private dayAt(time: number): string {
    if (!this.formatter) return new Date(time).toISOString().slice(0, 10);
    const parts = this.formatter.formatToParts(time);
    return ['year', 'month', 'day']
      .map((type) => parts.find((part) => part.type === type)?.value)
      .join('-');
  }

  private findDayChange(start: number, end: number): number {
    const day = this.dayAt(start);
    while (end - start > 1) {
      const middle = start + Math.floor((end - start) / 2);
      if (this.dayAt(middle) === day) start = middle;
      else end = middle;
    }
    return end;
  }
}
