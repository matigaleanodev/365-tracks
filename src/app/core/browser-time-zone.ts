import { DOCUMENT, inject, Injectable } from '@angular/core';
import { distinctUntilChanged, Observable } from 'rxjs';

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

@Injectable({ providedIn: 'root' })
export class BrowserTimeZone {
  private readonly document = inject(DOCUMENT);
  readonly timeZone = detectTimeZone();

  dayChanges(): Observable<string> {
    const formatter =
      this.timeZone === 'UTC'
        ? null
        : new Intl.DateTimeFormat('en', {
            timeZone: this.timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          });
    const dayAt = (time: number) => {
      if (!formatter) return new Date(time).toISOString().slice(0, 10);
      const parts = formatter.formatToParts(time);
      return ['year', 'month', 'day']
        .map((type) => parts.find((part) => part.type === type)?.value)
        .join('-');
    };

    return new Observable<string>((subscriber) => {
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const checkDay = () => {
        clearTimeout(timeout);
        const now = Date.now();
        const day = dayAt(now);
        subscriber.next(day);
        if (this.document.hidden || subscriber.closed) return;

        // Find the local date boundary even when a clock transition skips midnight.
        let start = now;
        let end = now + 48 * hours;
        while (end - start > 1) {
          const middle = start + Math.floor((end - start) / 2);
          if (dayAt(middle) === day) start = middle;
          else end = middle;
        }
        timeout = setTimeout(checkDay, Math.max(1, end - Date.now()));
      };
      const resume = () => {
        if (this.document.hidden) clearTimeout(timeout);
        else checkDay();
      };

      this.document.addEventListener('visibilitychange', resume);
      this.document.defaultView?.addEventListener('pageshow', resume);
      checkDay();
      return () => {
        clearTimeout(timeout);
        this.document.removeEventListener('visibilitychange', resume);
        this.document.defaultView?.removeEventListener('pageshow', resume);
      };
    }).pipe(distinctUntilChanged());
  }
}
