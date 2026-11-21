import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { combineLatest, distinctUntilChanged, map, switchMap } from 'rxjs';
import { loadState } from '../core/load-state';
import { TracksApi } from '../core/tracks-api';
import { AlbumCover } from '../shared/album-cover';

export function parsePage(value: string | null): number {
  const page = Number(value);
  return value !== null && /^\d+$/.test(value) && Number.isSafeInteger(page) && page > 0 ? page : 1;
}

@Component({
  selector: 'app-history-page',
  imports: [DatePipe, RouterLink, AlbumCover],
  templateUrl: './history-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistoryPage {
  private readonly api = inject(TracksApi);
  private readonly route = inject(ActivatedRoute);
  private readonly retries = signal(0);
  private readonly pageChanges = this.route.queryParamMap.pipe(
    map((params) => parsePage(params.get('page'))),
    distinctUntilChanged(),
  );
  protected readonly page = toSignal(this.pageChanges, { initialValue: 1 });
  protected readonly state = toSignal(
    combineLatest([this.pageChanges, toObservable(this.retries)]).pipe(
      switchMap(([page]) => loadState(this.api.history(page))),
    ),
    { initialValue: { status: 'loading' } as const },
  );
  protected readonly totalPages = computed(() => {
    const result = this.state();
    return result.status === 'ready'
      ? Math.max(1, Math.ceil(result.data.total / result.data.pageSize))
      : 1;
  });
  protected retry(): void {
    this.retries.update((value) => value + 1);
  }
}
