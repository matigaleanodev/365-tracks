import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  combineLatest,
  distinctUntilChanged,
  EMPTY,
  expand,
  filter,
  map,
  of,
  startWith,
  switchMap,
  tap,
} from 'rxjs';
import { BrowserTimeZone } from '../core/browser-time-zone';
import { loadState } from '../core/load-state';
import { isPublicationDate } from '../core/track';
import { TracksApi } from '../core/tracks-api';
import { TrackFeature } from '../shared/track-feature';

const calendarStart = '2027-01-01';

@Component({
  selector: 'app-track-page',
  imports: [RouterLink, TrackFeature],
  templateUrl: './track-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrackPage {
  private readonly api = inject(TracksApi);
  private readonly timeZone = inject(BrowserTimeZone);
  private readonly route = inject(ActivatedRoute);
  private readonly retries = signal(0);
  private readonly dateChanges = this.route.paramMap.pipe(
    map((params) => params.get('date')),
    distinctUntilChanged(),
  );
  protected readonly date = toSignal(this.dateChanges, { requireSync: true });
  protected readonly isToday = computed(() => this.date() === null);
  protected readonly state = toSignal(
    combineLatest([this.dateChanges, toObservable(this.retries)]).pipe(
      switchMap(([date]) => {
        if (date === null) return this.todayState();
        if (!isPublicationDate(date)) return of({ status: 'invalid' } as const);
        return loadState(this.api.byDate(date));
      }),
    ),
    { initialValue: { status: 'loading' } as const },
  );
  protected retry(): void {
    this.retries.update((value) => value + 1);
  }

  private todayState() {
    let confirmedDay: string | undefined;
    return this.timeZone.dayChanges().pipe(
      switchMap((day) => {
        if (confirmedDay === day) return EMPTY;

        const recheckTimes = this.timeZone.midnightRecheckTimes();
        let lastScheduled = 0;
        const refresh = loadState(this.api.today()).pipe(
          filter((result) => result.status !== 'loading'),
        );
        return refresh.pipe(
          expand((result) => {
            if (result.status !== 'ready') return EMPTY;
            if (result.data ? result.data.date >= day : day < calendarStart) return EMPTY;

            const now = Date.now();
            const pending = recheckTimes.filter((time) => time > lastScheduled);
            const recheck = pending.find((time) => time > now) ?? pending.at(-1);
            if (recheck === undefined) return EMPTY;

            lastScheduled = recheck;
            return this.timeZone.whenVisibleAt(recheck).pipe(switchMap(() => refresh));
          }),
          tap((result) => {
            if (result.status === 'ready') confirmedDay = result.data?.date;
          }),
          map((result) =>
            result.status === 'ready' && result.data === null && day < calendarStart
              ? ({ status: 'prelaunch' } as const)
              : result,
          ),
          startWith({ status: 'loading' } as const),
        );
      }),
    );
  }
}
