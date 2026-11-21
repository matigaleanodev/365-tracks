import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { exhaustMap, scan, startWith, Subject } from 'rxjs';
import { environment } from '../../environments/environment';
import { loadState } from '../core/load-state';
import type { Track } from '../core/track';
import { TracksApi } from '../core/tracks-api';
import { AlbumCover } from '../shared/album-cover';

interface HistoryState {
  readonly status: 'loading' | 'error' | 'ready';
  readonly tracks: readonly Track[];
  readonly nextCursor: string | null;
}

const initialState: HistoryState = { status: 'loading', tracks: [], nextCursor: null };

function publicPlaylists(config: Readonly<Record<string, string>>) {
  return Object.entries(config)
    .flatMap(([year, value]) => {
      if (!/^\d{4}$/.test(year) || Number(year) < 2027 || !URL.canParse(value)) return [];
      const url = new URL(value);
      if (
        url.origin !== 'https://open.spotify.com' ||
        url.username ||
        url.password ||
        !/^\/playlist\/[A-Za-z0-9]{22}\/?$/.test(url.pathname)
      ) {
        return [];
      }
      return [{ year, href: url.origin + url.pathname }];
    })
    .sort((a, b) => Number(b.year) - Number(a.year));
}

@Component({
  selector: 'app-history-page',
  imports: [DatePipe, RouterLink, AlbumCover],
  templateUrl: './history-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistoryPage {
  private readonly api = inject(TracksApi);
  private readonly requests = new Subject<string | null>();
  protected readonly playlists = environment.fixtures
    ? []
    : publicPlaylists(environment.spotifyPlaylists);
  protected readonly state = toSignal(
    this.requests.pipe(
      startWith(null),
      exhaustMap((cursor) => loadState(this.api.history(cursor))),
      scan((state: HistoryState, result): HistoryState => {
        if (result.status !== 'ready') return { ...state, status: result.status };

        const tracks = new Map(state.tracks.map((track) => [track.date, track]));
        for (const track of result.data.data) {
          if (!tracks.has(track.date)) tracks.set(track.date, track);
        }
        return {
          status: 'ready',
          tracks: [...tracks.values()],
          nextCursor: result.data.pagination.nextCursor,
        };
      }, initialState),
    ),
    { initialValue: initialState },
  );

  protected loadMore(): void {
    const { status, nextCursor } = this.state();
    if (status === 'error' || (status === 'ready' && nextCursor !== null)) {
      this.requests.next(nextCursor);
    }
  }
}
