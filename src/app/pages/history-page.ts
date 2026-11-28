import { NgTemplateOutlet, ViewportScroller } from '@angular/common';
import {
  afterNextRender,
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  DOCUMENT,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationStart, Router, RouterLink, Scroll } from '@angular/router';
import { exhaustMap, filter, scan, startWith, Subject, take } from 'rxjs';
import { environment } from '../../environments/environment';
import { HistoryReturn, type HistoryState } from '../core/history-return';
import { loadState } from '../core/load-state';
import { TracksApi } from '../core/tracks-api';
import { AlbumCover } from '../shared/album-cover';
import type { Track } from '../core/track';

const dateFormat = new Intl.DateTimeFormat('es-AR', { dateStyle: 'long', timeZone: 'UTC' });
const monthFormat = new Intl.DateTimeFormat('es-AR', { month: 'long', timeZone: 'UTC' });
const initialState: HistoryState = {
  status: 'loading',
  tracks: [],
  nextCursor: null,
  addedCount: null,
};

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
  imports: [RouterLink, AlbumCover, NgTemplateOutlet],
  templateUrl: './history-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistoryPage {
  private readonly api = inject(TracksApi);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly heading = viewChild<ElementRef<HTMLHeadingElement>>('heading');
  private readonly playlistHeading = viewChild<ElementRef<HTMLHeadingElement>>('playlistHeading');
  private readonly pageStatus = viewChild<ElementRef<HTMLParagraphElement>>('pageStatus');
  private readonly pageButton = viewChild<ElementRef<HTMLButtonElement>>('pageButton');
  private readonly retryButton = viewChild<ElementRef<HTMLButtonElement>>('retryButton');
  private readonly retrying = signal(false);
  protected readonly retryingInitial = this.retrying.asReadonly();
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly scroller = inject(ViewportScroller);
  private readonly element: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly historyReturn = inject(HistoryReturn);
  private readonly origin = this.historyReturn.restore();
  private readonly initial = this.origin?.state ?? initialState;
  private readonly requests = new Subject<string | null>();
  protected readonly playlists = environment.fixtures
    ? []
    : publicPlaylists(environment.spotifyPlaylists);
  private readonly queryParams = toSignal(this.route.queryParams, { requireSync: true });
  protected readonly playlistHref = computed(() =>
    this.router.serializeUrl(
      this.router.createUrlTree(['/history'], {
        queryParams: this.queryParams(),
        fragment: 'playlists',
      }),
    ),
  );
  private readonly fragment = toSignal(this.route.fragment, { requireSync: true });
  protected readonly state = toSignal(
    this.requests.pipe(
      (requests) => (this.origin ? requests : requests.pipe(startWith(null))),
      exhaustMap((cursor) => loadState(this.api.history(cursor))),
      scan((state: HistoryState, result): HistoryState => {
        if (result.status !== 'ready') return { ...state, status: result.status };

        const tracks = new Map(state.tracks.map((track) => [track.date, track]));
        for (const track of result.data.data) {
          if (!tracks.has(track.date)) tracks.set(track.date, track);
        }
        const entries = [...tracks.values()];
        const firstAdded = entries[state.tracks.length];
        const nextCursor = result.data.pagination.nextCursor;
        if (state.nextCursor !== null) {
          this.focusAfterRequest(this.pageButton()?.nativeElement, () =>
            firstAdded
              ? this.document.getElementById('date-' + firstAdded.date)
              : nextCursor === null
                ? this.pageStatus()?.nativeElement
                : undefined,
          );
        } else if (this.retrying()) {
          this.focusAfterRequest(
            this.retryButton()?.nativeElement,
            () => this.heading()?.nativeElement,
          );
        }
        this.retrying.set(false);
        return {
          status: 'ready',
          tracks: entries,
          nextCursor,
          addedCount: state.nextCursor === null ? null : entries.length - state.tracks.length,
        };
      }, this.initial),
    ),
    { initialValue: this.initial },
  );

  protected readonly months = computed(() => {
    const months = new Map<string, Track[]>();
    for (const track of this.state().tracks) {
      const key = track.date.slice(0, 7);
      const entries = months.get(key);
      if (entries) entries.push(track);
      else months.set(key, [track]);
    }
    return Array.from(months, ([key, tracks]) => ({
      key,
      year: key.slice(0, 4),
      label: monthFormat.format(new Date(key + '-01T00:00:00Z')),
      tracks,
    }));
  });

  protected readonly paginationAnnouncement = computed(() => {
    const { status, tracks, nextCursor, addedCount: count } = this.state();
    if (nextCursor !== null && status === 'loading') return 'Cargando más canciones…';
    if (status !== 'ready') return '';
    const added =
      count === 1 ? 'Se agregó 1 canción.' : count ? `Se agregaron ${count} canciones.` : '';
    const end =
      nextCursor === null && (tracks.length || count !== null)
        ? 'Llegaste al final del historial.'
        : '';
    return [added, end].filter(Boolean).join(' ');
  });

  constructor() {
    let appliedFragment: string | null = null;
    if (this.playlists.length) {
      afterRenderEffect({
        write: () => {
          const fragment = this.fragment();
          if (this.state().status === 'loading' || fragment === appliedFragment) return;
          appliedFragment = fragment;
          if (fragment === 'playlists' && !this.origin) this.focusPlaylists();
        },
      });
    }
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationStart),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.historyReturn.capture(this.state()));
    const origin = this.origin;
    if (!origin && this.router.currentNavigation()?.previousNavigation) {
      afterNextRender({
        write: () => this.heading()?.nativeElement.focus({ preventScroll: true }),
      });
    }
    if (origin) {
      afterNextRender({
        write: () => {
          this.element.nativeElement
            .querySelector<HTMLAnchorElement>('a[href="' + origin.detailUrl + '"]')
            ?.focus({ preventScroll: true });
        },
      });
      this.router.events
        .pipe(
          filter((event) => event instanceof Scroll),
          take(1),
          takeUntilDestroyed(),
        )
        .subscribe(() => this.scroller.scrollToPosition(origin.position));
    }
  }

  protected loadMore(): void {
    const { status, nextCursor } = this.state();
    if (status === 'error' || (status === 'ready' && nextCursor !== null)) {
      if (status === 'error' && nextCursor === null) this.retrying.set(true);
      this.requests.next(nextCursor);
    }
  }

  protected dateLabel(date: string): string {
    return dateFormat.format(new Date(date));
  }

  protected jumpToPlaylists(event: MouseEvent): void {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    this.focusPlaylists();
  }

  private focusPlaylists(): void {
    const heading = this.playlistHeading()?.nativeElement;
    if (!heading) return;
    heading.scrollIntoView({ block: 'start' });
    heading.focus({ preventScroll: true });
  }

  private focusAfterRequest(
    button: HTMLButtonElement | undefined,
    target: () => HTMLElement | null | undefined,
  ): void {
    if (!button || this.document.activeElement !== button) return;
    afterNextRender(
      {
        write: () => {
          const active = this.document.activeElement;
          if (active === button || (!button.isConnected && active === this.document.body)) {
            target()?.focus();
          }
        },
      },
      { injector: this.injector },
    );
  }
}
