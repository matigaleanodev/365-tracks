import { DatePipe, formatDate } from '@angular/common';
import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  DOCUMENT,
  ElementRef,
  inject,
  LOCALE_ID,
  signal,
  viewChild,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
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
import { HistoryReturn } from '../core/history-return';
import { loadState } from '../core/load-state';
import { isPublicationDate } from '../core/track';
import { TracksApi } from '../core/tracks-api';
import { TrackFeature } from '../shared/track-feature';
import { environment } from '../../environments/environment';

const calendarStart = '2027-01-01';

@Component({
  selector: 'app-track-page',
  imports: [DatePipe, RouterLink, TrackFeature],
  templateUrl: './track-page.html',
  styleUrl: './track-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrackPage {
  private readonly api = inject(TracksApi);
  private readonly document = inject(DOCUMENT);
  private readonly locale = inject(LOCALE_ID);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly navigatedInApp = inject(Router).currentNavigation()?.previousNavigation != null;
  private readonly timeZone = inject(BrowserTimeZone);
  private readonly route = inject(ActivatedRoute);
  private readonly retries = signal(0);
  private handledRetry = 0;
  private readonly stateHeading = viewChild<ElementRef<HTMLHeadingElement>>('stateHeading');
  protected readonly fixtures = environment.fixtures;
  private readonly edition = viewChild('edition', { read: ElementRef<HTMLElement> });
  private readonly publicationAnnouncement = signal('');
  private focusedBeforeChange: HTMLElement | undefined;
  protected readonly announcement = this.publicationAnnouncement.asReadonly();
  protected readonly historyReturn = inject(HistoryReturn);
  protected readonly fromHistory = this.historyReturn.record(
    this.route.snapshot.paramMap.get('date') ?? '',
  );
  private readonly dateChanges = this.route.paramMap.pipe(
    map((params) => params.get('date')),
    distinctUntilChanged(),
  );
  protected readonly date = toSignal(this.dateChanges, { requireSync: true });
  protected readonly isToday = computed(() => this.date() === null);
  protected readonly state = toSignal(
    combineLatest([this.dateChanges, toObservable(this.retries)]).pipe(
      switchMap(([date, retry]) => {
        const retrying = retry !== this.handledRetry;
        this.handledRetry = retry;
        if (date !== null && !isPublicationDate(date)) return of({ status: 'invalid' } as const);
        const request =
          date === null
            ? this.todayState(retrying)
            : loadState(this.api.byDate(date)).pipe(
                filter((result) => result.status !== 'loading'),
              );
        return request.pipe(startWith({ status: retrying ? 'retrying' : 'loading' } as const));
      }),
      tap((result) => {
        const active = this.document.activeElement;
        this.focusedBeforeChange =
          active instanceof HTMLElement &&
          (this.host.nativeElement.contains(active) ||
            (result.status === 'prelaunch' && active.closest('header nav')))
            ? active
            : undefined;
      }),
    ),
    { initialValue: { status: 'loading' } as const },
  );

  constructor() {
    let settledDate: string | null | undefined;
    let previousStatus = this.state().status;
    let listenFallback: HTMLElement | undefined;

    afterRenderEffect({
      write: () => {
        const status = this.state().status;
        const date = this.date();
        const edition: HTMLElement | undefined = this.edition()?.nativeElement;
        const heading = edition?.querySelector('h1') ?? this.stateHeading()?.nativeElement;
        const active = this.document.activeElement;
        const previousFocus = this.focusedBeforeChange;
        this.focusedBeforeChange = undefined;

        if (heading && status !== 'retrying') {
          const movedToNewPage = date !== settledDate && (date !== null || this.navigatedInApp);
          const retrySucceeded = previousStatus === 'retrying' && status !== 'error';
          const focusWasLost = active === this.document.body;

          if (movedToNewPage || (retrySucceeded && focusWasLost)) {
            heading.focus({ preventScroll: true });
          } else if (
            status === 'prelaunch' &&
            (focusWasLost || active === previousFocus) &&
            previousFocus?.closest('header nav')
          ) {
            previousFocus
              .closest('header')
              ?.querySelector('select')
              ?.focus({ preventScroll: true });
          } else if (focusWasLost && previousFocus && !previousFocus.isConnected) {
            if (edition && previousFocus === listenFallback) {
              edition.querySelector<HTMLAnchorElement>('.listen')?.focus({ preventScroll: true });
            } else {
              heading.focus({ preventScroll: true });
              if (previousFocus.matches('.listen') || previousFocus === listenFallback) {
                listenFallback = heading;
              }
            }
          }
          settledDate = date;
          if (edition) listenFallback = undefined;
        }
        previousStatus = status;
      },
    });
  }

  protected retry(): void {
    if (this.state().status !== 'error' || this.retries() !== this.handledRetry) return;
    this.retries.update((value) => value + 1);
  }

  private isPrelaunch(day: string): boolean {
    // Fixture mode ignores the device date; `?fixture=prelaunch` previews the prelaunch view.
    if (environment.fixtures) {
      return new URLSearchParams(this.document.location.search).get('fixture') === 'prelaunch';
    }
    // Exception to the API-owned date: the device clock only decides when prelaunch ends.
    return day < calendarStart;
  }

  private todayState(afterError: boolean) {
    let announceUnavailable = afterError;
    let confirmedDay: string | undefined;
    let previousTrackDate: string | undefined;
    let previouslyUnavailable = false;
    let wasPrelaunch = false;
    this.publicationAnnouncement.set('');
    return this.timeZone.dayChanges().pipe(
      switchMap((day) => {
        if (confirmedDay === day) return EMPTY;
        // Before launch there is nothing to publish: wait for the visitor's local launch day.
        if (this.isPrelaunch(day)) {
          wasPrelaunch = true;
          return of({ status: 'prelaunch' } as const);
        }

        const recheckTimes = this.timeZone.midnightRecheckTimes();
        let lastScheduled = 0;
        const refresh = loadState(this.api.today()).pipe(
          filter((result) => result.status !== 'loading'),
        );
        return refresh.pipe(
          expand((result) => {
            if (result.status !== 'ready') return EMPTY;
            if (result.data && result.data.date >= day) return EMPTY;

            const now = Date.now();
            const pending = recheckTimes.filter((time) => time > lastScheduled);
            const recheck = pending.find((time) => time > now) ?? pending.at(-1);
            if (recheck === undefined) return EMPTY;

            lastScheduled = recheck;
            return this.timeZone.whenVisibleAt(recheck).pipe(switchMap(() => refresh));
          }),
          tap((result) => {
            if (result.status === 'ready') {
              confirmedDay = result.data?.date;
              if (result.data) {
                if (
                  wasPrelaunch ||
                  previouslyUnavailable ||
                  (previousTrackDate && previousTrackDate !== result.data.date)
                ) {
                  const date = formatDate(
                    result.data.date + 'T00:00:00Z',
                    'longDate',
                    this.locale,
                    'UTC',
                  );
                  this.publicationAnnouncement.set(
                    `Nueva edición del ${date}: ${result.data.title}`,
                  );
                }
                previousTrackDate = result.data.date;
                previouslyUnavailable = false;
              } else {
                if (
                  announceUnavailable ||
                  wasPrelaunch ||
                  (previousTrackDate && !previouslyUnavailable)
                ) {
                  this.publicationAnnouncement.set('Todavía no hay canción de hoy');
                }
                previouslyUnavailable = true;
              }
              wasPrelaunch = false;
              announceUnavailable = false;
            }
          }),
        );
      }),
    );
  }
}
