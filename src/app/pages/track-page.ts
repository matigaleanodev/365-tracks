import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { combineLatest, map, switchMap } from 'rxjs';
import { loadState } from '../core/load-state';
import { TracksApi } from '../core/tracks-api';
import { TrackFeature } from '../shared/track-feature';

@Component({
  selector: 'app-track-page',
  imports: [RouterLink, TrackFeature],
  templateUrl: './track-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrackPage {
  private readonly api = inject(TracksApi);
  private readonly route = inject(ActivatedRoute);
  private readonly retries = signal(0);
  protected readonly date = toSignal(this.route.paramMap.pipe(map((params) => params.get('date'))));
  protected readonly isToday = computed(() => !this.date());
  protected readonly state = toSignal(
    combineLatest([this.route.paramMap, toObservable(this.retries)]).pipe(
      switchMap(([params]) =>
        loadState(params.has('date') ? this.api.byDate(params.get('date')!) : this.api.today()),
      ),
    ),
    { initialValue: { status: 'loading' } as const },
  );
  protected retry(): void {
    this.retries.update((value) => value + 1);
  }
}
