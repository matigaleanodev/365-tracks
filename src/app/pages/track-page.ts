import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { combineLatest, distinctUntilChanged, map, of, switchMap } from 'rxjs';
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
        if (date === null) {
          return this.timeZone
            .dayChanges()
            .pipe(
              switchMap((day) =>
                loadState(this.api.today()).pipe(
                  map((result) =>
                    result.status === 'ready' && result.data === null && day < calendarStart
                      ? ({ status: 'prelaunch' } as const)
                      : result,
                  ),
                ),
              ),
            );
        }
        if (!isPublicationDate(date)) return of({ status: 'invalid' } as const);
        return loadState(this.api.byDate(date));
      }),
    ),
    { initialValue: { status: 'loading' } as const },
  );
  protected retry(): void {
    this.retries.update((value) => value + 1);
  }
}
