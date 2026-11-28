import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { environment } from '../../environments/environment';
import { routes } from '../app.routes';
import type { Track } from '../core/track';
import { apiError, sampleTrack, sampleTrackWithEditorial } from '../testing/sample-track';

describe('Public pages', () => {
  const defaultEnvironment = { ...environment };
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let document: Document;
  const timezone = 'America/New_York';
  const text = () => harness.routeNativeElement?.textContent ?? '';
  const button = () => harness.routeNativeElement?.querySelector('button');
  const todayRequest = () =>
    http.expectOne((req) => req.url.endsWith('/today') && req.params.get('timezone') === timezone);
  const useClock = (time: number) => {
    vi.useFakeTimers({
      toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    });
    vi.setSystemTime(time);
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  };
  const historyDates = () =>
    Array.from(
      harness.routeNativeElement?.querySelectorAll('app-history-page section ul time') ?? [],
      (date) => date.getAttribute('datetime'),
    );
  const historyRequest = (cursor: string | null = null) =>
    http.expectOne(
      (req) =>
        req.url.endsWith('/tracks') &&
        req.params.get('timezone') === timezone &&
        req.params.get('limit') === '30' &&
        req.params.get('cursor') === cursor,
    );
  const historyBody = (data: Track[], nextCursor: string | null = null) => ({
    data,
    pagination: { limit: 30, nextCursor },
  });

  beforeEach(async () => {
    // Default to a day after launch; prelaunch tests set their own clock.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2027-01-01T17:00:00Z'));
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
      ...new Intl.DateTimeFormat('en', { timeZone: timezone }).resolvedOptions(),
      timeZone: timezone,
    });
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    document = TestBed.inject(DOCUMENT);
    harness = await RouterTestingHarness.create();
  });
  afterEach(() => {
    Object.assign(environment, defaultEnvironment);
    vi.useRealTimers();
    vi.restoreAllMocks();
    http.verify();
  });

  it('does not request today before the local launch day even when the UTC date is January 1', async () => {
    vi.setSystemTime(new Date('2027-01-01T04:59:00Z'));
    await harness.navigateByUrl('/');
    http.expectNone((req) => req.url.endsWith('/today'));
    harness.detectChanges();
    expect(text()).toContain('Una canción compartida cada día.');
    expect(text()).not.toContain('Cargando la canción del día');
    expect(harness.routeNativeElement?.querySelector('time')?.dateTime).toBe('2027-01-01');
    expect(harness.routeNativeElement?.querySelector('a[href="/history"]')).toBeNull();
    expect(harness.routeNativeElement?.querySelector('[data-folio]')).toBeNull();

    vi.setSystemTime(new Date('2027-01-01T05:00:00Z'));
    document.defaultView?.dispatchEvent(new Event('pageshow'));
    todayRequest().flush(apiError('TRACK_NOT_FOUND'), { status: 404, statusText: 'Not Found' });
    harness.detectChanges();
    expect(text()).toContain('Todavía no hay canción de hoy');
    expect(text()).not.toContain('Una canción compartida cada día.');
  });

  it.each([
    ['Pacific/Kiritimati', '2026-12-31T10:00:00Z'],
    ['Asia/Tokyo', '2026-12-31T15:00:00Z'],
    ['UTC', '2027-01-01T00:00:00Z'],
    ['America/Buenos_Aires', '2027-01-01T03:00:00Z'],
    ['Etc/GMT+12', '2027-01-01T12:00:00Z'],
  ])('starts requesting today at the local launch midnight in %s', async (zone, launch) => {
    vi.mocked(Intl.DateTimeFormat.prototype.resolvedOptions).mockReturnValue({
      ...new Intl.DateTimeFormat('en', { timeZone: zone }).resolvedOptions(),
      timeZone: zone,
    });
    useClock(Date.parse(launch) - 6 * 60 * 60 * 1000);
    await harness.navigateByUrl('/');
    http.expectNone(() => true);
    harness.detectChanges();
    expect(text()).toContain('Una canción compartida cada día.');

    vi.advanceTimersByTime(6 * 60 * 60 * 1000 - 1);
    http.expectNone(() => true);
    vi.advanceTimersByTime(1);
    http
      .expectOne((req) => req.url.endsWith('/today') && req.params.get('timezone') === zone)
      .flush({ data: sampleTrack });
    harness.detectChanges();
    expect(text()).toContain(sampleTrack.title);
    expect(text()).not.toContain('Una canción compartida cada día.');
    expect(harness.routeNativeElement?.querySelector('[role="status"]')?.textContent).toContain(
      'Nueva edición',
    );
  });

  it('requests today when a tab hidden across the launch midnight becomes visible', async () => {
    vi.setSystemTime(new Date('2027-01-01T04:30:00Z'));
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    await harness.navigateByUrl('/');
    hidden.mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    vi.setSystemTime(new Date('2027-01-01T05:30:00Z'));
    http.expectNone(() => true);

    hidden.mockReturnValue(false);
    document.dispatchEvent(new Event('visibilitychange'));
    todayRequest().flush({ data: sampleTrack });
    harness.detectChanges();
    expect(text()).toContain(sampleTrack.title);
    expect(harness.routeNativeElement?.querySelector('[role="status"]')?.textContent).toContain(
      'Nueva edición',
    );
  });

  it('keeps real failures on launch day apart from an unpublished selection', async () => {
    useClock(Date.parse('2027-01-01T04:59:00Z'));
    await harness.navigateByUrl('/');
    http.expectNone(() => true);

    vi.advanceTimersByTime(60_000);
    todayRequest().flush(apiError('INTERNAL_ERROR'), { status: 500, statusText: 'Error' });
    harness.detectChanges();
    expect(text()).toContain('No pudimos cargar la canción');
    expect(text()).not.toContain('Una canción compartida cada día.');

    button()?.click();
    TestBed.tick();
    todayRequest().error(new ProgressEvent('error'), { status: 0, statusText: '' });
    harness.detectChanges();
    expect(text()).toContain('No pudimos cargar la canción');

    button()?.click();
    TestBed.tick();
    todayRequest().flush({ message: 'Not Found' }, { status: 404, statusText: 'Not Found' });
    harness.detectChanges();
    expect(text()).toContain('No pudimos cargar la canción');

    button()?.click();
    TestBed.tick();
    todayRequest().flush(apiError('TRACK_NOT_FOUND'), { status: 404, statusText: 'Not Found' });
    harness.detectChanges();
    expect(text()).toContain('Todavía no hay canción de hoy');
    expect(harness.routeNativeElement?.querySelector('button')).toBeNull();
    expect(harness.routeNativeElement?.querySelector('[role="status"]')?.textContent).toContain(
      'Todavía no hay canción de hoy',
    );
  });

  it('announces the waiting state after a retry once launch has passed', async () => {
    vi.setSystemTime(new Date('2027-01-05T15:00:00Z'));
    await harness.navigateByUrl('/');
    todayRequest().flush(apiError('INTERNAL_ERROR'), { status: 500, statusText: 'Error' });
    harness.detectChanges();
    expect(text()).toContain('No pudimos cargar la canción');

    button()?.click();
    TestBed.tick();
    todayRequest().flush(apiError('TRACK_NOT_FOUND'), { status: 404, statusText: 'Not Found' });
    harness.detectChanges();
    expect(text()).toContain('Todavía no hay canción de hoy');
    expect(harness.routeNativeElement?.querySelector('[role="status"]')?.textContent).toContain(
      'Todavía no hay canción de hoy',
    );
  });

  describe('prelaunch in fixture mode', () => {
    const useSearch = (search: string) => window.history.replaceState(null, '', '/' + search);
    afterEach(() => useSearch(''));

    it('previews prelaunch with ?fixture=prelaunch regardless of the device date', async () => {
      Object.assign(environment, { fixtures: true });
      vi.setSystemTime(new Date('2027-03-01T15:00:00Z'));
      useSearch('?fixture=prelaunch');
      await harness.navigateByUrl('/');
      http.expectNone(() => true);
      harness.detectChanges();
      expect(text()).toContain('Una canción compartida cada día.');
    });

    it('shows fixture songs without the parameter before the launch date', async () => {
      Object.assign(environment, { fixtures: true });
      vi.setSystemTime(new Date('2026-11-28T15:00:00Z'));
      await harness.navigateByUrl('/');
      todayRequest().flush({ data: sampleTrack });
      harness.detectChanges();
      expect(text()).toContain(sampleTrack.title);
    });

    it('ignores ?fixture=prelaunch outside fixture mode', async () => {
      vi.setSystemTime(new Date('2027-03-01T15:00:00Z'));
      useSearch('?fixture=prelaunch');
      await harness.navigateByUrl('/');
      todayRequest().flush({ data: sampleTrack });
      harness.detectChanges();
      expect(text()).toContain(sampleTrack.title);
      expect(text()).not.toContain('Una canción compartida cada día.');
    });
  });

  it('waits on TRACK_NOT_FOUND after launch until the first selection is published', async () => {
    const launch = Date.parse('2027-01-01T05:00:00Z');
    const unpublished = () =>
      todayRequest().flush(apiError('TRACK_NOT_FOUND'), { status: 404, statusText: 'Not Found' });
    useClock(launch - 60 * 60 * 1000);
    await harness.navigateByUrl('/');
    http.expectNone(() => true);

    vi.advanceTimersByTime(60 * 60 * 1000);
    unpublished();
    harness.detectChanges();
    const element = harness.routeNativeElement!;
    expect(text()).toContain('Todavía no hay canción de hoy');
    expect(text()).not.toContain('No pudimos cargar la canción');
    expect(element.querySelector('[role="alert"]')).toBeNull();
    expect(element.querySelector('button')).toBeNull();
    expect(element.querySelector('a[href="/history"]')).toBeTruthy();
    expect(element.querySelector('[role="status"]')?.textContent).toContain(
      'Todavía no hay canción de hoy',
    );

    vi.advanceTimersByTime(60_000);
    unpublished();
    harness.detectChanges();
    expect(text()).toContain('Todavía no hay canción de hoy');

    vi.advanceTimersByTime(60_000);
    todayRequest().flush({ data: sampleTrack });
    harness.detectChanges();
    expect(text()).toContain(sampleTrack.title);
    expect(element.querySelector('[role="status"]')?.textContent).toContain('Nueva edición');
  });

  it('refreshes only today when a hidden tab returns on a new local date', async () => {
    vi.setSystemTime(new Date('2027-01-02T04:59:00Z'));
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    const visibilityChanged = () => document.dispatchEvent(new Event('visibilitychange'));
    const today = () => http.expectOne((req) => req.url.endsWith('/today'));
    const secondDay = { ...sampleTrack, date: '2027-01-02' };

    await harness.navigateByUrl('/');
    const beforeMidnight = today();
    hidden.mockReturnValue(true);
    visibilityChanged();
    vi.setSystemTime(new Date('2027-01-02T05:01:00Z'));
    http.expectNone(() => true);
    hidden.mockReturnValue(false);
    visibilityChanged();
    expect(beforeMidnight.cancelled).toBe(true);
    today().flush({ data: secondDay });
    harness.detectChanges();
    expect(harness.routeNativeElement?.querySelector('time')?.dateTime).toBe(secondDay.date);

    visibilityChanged();
    document.defaultView?.dispatchEvent(new Event('pageshow'));
    http.expectNone(() => true);

    vi.setSystemTime(new Date('2027-01-03T06:00:00Z'));
    document.defaultView?.dispatchEvent(new Event('pageshow'));
    today().flush({ data: { ...sampleTrack, date: '2027-01-03' } });

    await harness.navigateByUrl('/tracks/2027-01-01');
    http.expectOne((req) => req.url.endsWith('/2027-01-01')).flush({ data: sampleTrack });
    harness.detectChanges();
    vi.setSystemTime(new Date('2027-01-04T06:00:00Z'));
    visibilityChanged();
    document.defaultView?.dispatchEvent(new Event('pageshow'));
    http.expectNone(() => true);
    expect(text()).toContain(sampleTrack.title);
  });

  it.each([
    ['one minute fast', 60_000],
    ['one minute slow', -60_000],
    ['correct', 0],
  ])('updates the selection when the device clock is %s', async (_clock, clockOffset) => {
    const midnight = Date.parse('2027-01-02T05:00:00Z');
    const nextTrack = { ...sampleTrack, date: '2027-01-02', title: 'Next track' };
    useClock(midnight - 120_000 + clockOffset);
    const respondForServerTime = () => {
      const track = Date.now() - clockOffset >= midnight ? nextTrack : sampleTrack;
      todayRequest().flush({ data: track });
      harness.detectChanges();
    };

    await harness.navigateByUrl('/');
    respondForServerTime();
    expect(text()).toContain(sampleTrack.title);

    vi.advanceTimersByTime(120_000 - clockOffset - 1);
    http.expectNone(() => true);
    vi.advanceTimersByTime(1);
    respondForServerTime();

    if (clockOffset > 0) {
      expect(text()).toContain(sampleTrack.title);
      vi.advanceTimersByTime(59_999);
      http.expectNone(() => true);
      vi.advanceTimersByTime(1);
      respondForServerTime();
    }

    expect(text()).toContain(nextTrack.title);
    vi.advanceTimersByTime(12 * 60 * 60 * 1000);
    http.expectNone(() => true);
  });

  it('rechecks an old selection when opened just after device midnight', async () => {
    const midnight = Date.parse('2027-01-02T05:00:00Z');
    useClock(midnight + 30_000);
    await harness.navigateByUrl('/');
    todayRequest().flush({ data: sampleTrack });

    vi.advanceTimersByTime(30_000);
    const nextTrack = { ...sampleTrack, date: '2027-01-02' };
    todayRequest().flush({ data: nextTrack });
    harness.detectChanges();
    expect(harness.routeNativeElement?.querySelector('time')?.dateTime).toBe(nextTrack.date);
  });

  it('recovers a missed recheck when returning on the same device date', async () => {
    useClock(Date.parse('2027-01-02T05:00:00Z'));
    const hidden = vi.spyOn(document, 'hidden', 'get');
    await harness.navigateByUrl('/');
    todayRequest().flush({ data: sampleTrack });

    hidden.mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(5 * 60 * 1000);
    http.expectNone(() => true);

    hidden.mockReturnValue(false);
    document.dispatchEvent(new Event('visibilitychange'));
    const nextTrack = { ...sampleTrack, date: '2027-01-02' };
    todayRequest().flush({ data: nextTrack });
    harness.detectChanges();
    expect(harness.routeNativeElement?.querySelector('time')?.dateTime).toBe(nextTrack.date);
    document.defaultView?.dispatchEvent(new Event('pageshow'));
    http.expectNone(() => true);
  });

  it('recovers from an old response delivered after the midnight window', async () => {
    useClock(Date.parse('2027-01-02T05:00:00Z'));
    await harness.navigateByUrl('/');
    const pending = todayRequest();
    vi.advanceTimersByTime(180_000);
    http.expectNone(() => true);

    pending.flush({ data: sampleTrack });
    const nextTrack = { ...sampleTrack, date: '2027-01-02' };
    todayRequest().flush({ data: nextTrack });
    harness.detectChanges();
    expect(harness.routeNativeElement?.querySelector('time')?.dateTime).toBe(nextTrack.date);
    vi.advanceTimersByTime(180_000);
    http.expectNone(() => true);
  });

  it('makes no daily requests before launch, including around local midnight', async () => {
    useClock(Date.parse('2026-12-31T05:00:00Z'));
    await harness.navigateByUrl('/');
    http.expectNone(() => true);
    document.dispatchEvent(new Event('visibilitychange'));
    document.defaultView?.dispatchEvent(new Event('pageshow'));
    vi.advanceTimersByTime(180_000);
    http.expectNone(() => true);
    harness.detectChanges();
    expect(text()).toContain('Una canción compartida cada día.');
  });

  it('stops checking an unprepared selection after the midnight window', async () => {
    useClock(Date.parse('2027-01-02T05:00:00Z'));
    const unpublished = () =>
      todayRequest().flush(apiError('TRACK_NOT_FOUND'), {
        status: 404,
        statusText: 'Not Found',
      });
    await harness.navigateByUrl('/');
    unpublished();
    harness.detectChanges();
    expect(text()).toContain('Todavía no hay canción de hoy');

    for (let attempt = 0; attempt < 2; attempt++) {
      vi.advanceTimersByTime(59_999);
      http.expectNone(() => true);
      vi.advanceTimersByTime(1);
      unpublished();
    }
    vi.advanceTimersByTime(12 * 60 * 60 * 1000);
    http.expectNone(() => true);
    harness.detectChanges();
    expect(text()).toContain('Todavía no hay canción de hoy');
  });

  it('removes a scheduled midnight recheck when navigating to historical detail', async () => {
    useClock(Date.parse('2027-01-02T05:00:00Z'));
    await harness.navigateByUrl('/');
    todayRequest().flush({ data: sampleTrack });

    await harness.navigateByUrl('/tracks/2027-01-01');
    http.expectOne((req) => req.url.endsWith('/2027-01-01')).flush({ data: sampleTrack });
    vi.advanceTimersByTime(25 * 60 * 60 * 1000);
    document.dispatchEvent(new Event('visibilitychange'));
    document.defaultView?.dispatchEvent(new Event('pageshow'));
    http.expectNone(() => true);
    harness.detectChanges();
    expect(text()).toContain(sampleTrack.title);
  });

  it.each([
    ['2027-01-01', '001'],
    ['2027-02-04', '035'],
    ['2027-12-31', '365'],
    ['2028-01-01', null],
  ])('displays the editorial folio for API date %s', async (date, folio) => {
    await harness.navigateByUrl('/tracks/' + date);
    http.expectOne((req) => req.url.endsWith('/' + date)).flush({ data: { ...sampleTrack, date } });
    harness.detectChanges();
    const element = harness.routeNativeElement!;
    expect(element.querySelector('time')?.dateTime).toBe(date);
    expect(element.querySelector('[data-folio]')?.getAttribute('data-folio') ?? null).toBe(folio);
    expect(element.querySelector('.editorial-note')).toBeNull();
  });

  it('preserves an incremental history row when returning from its detail', async () => {
    await harness.navigateByUrl('/history?source=archive');
    historyRequest().flush(historyBody([sampleTrack], 'next'));
    harness.detectChanges();
    button()?.click();
    const later = { ...sampleTrack, date: '2027-01-02' };
    historyRequest('next').flush(historyBody([later]));
    harness.detectChanges();
    harness.routeNativeElement
      ?.querySelector<HTMLAnchorElement>('a[href="/tracks/2027-01-02"]')
      ?.click();
    await harness.fixture.whenStable();
    http.expectOne((req) => req.url.endsWith('/2027-01-02')).flush({ data: later });
    harness.detectChanges();
    await harness.fixture.whenStable();
    expect(text()).toContain('Volver al historial');
    harness.routeNativeElement
      ?.querySelector<HTMLAnchorElement>('a[href="/history?source=archive"]')
      ?.click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(historyDates()).toEqual([sampleTrack.date, later.date]);
    http.expectNone((req) => req.url.endsWith('/tracks'));
  });

  it('retries daily failures and displays the complete selection', async () => {
    await harness.navigateByUrl('/');
    http
      .expectOne((req) => req.url.endsWith('/today'))
      .flush(apiError('INTERNAL_ERROR'), {
        status: 500,
        statusText: 'Error',
      });
    harness.detectChanges();
    expect(text()).toContain('No pudimos cargar la canción');
    const retry = button();
    retry?.focus();
    retry?.click();
    TestBed.tick();
    expect(button()).toBe(retry);
    expect(retry?.getAttribute('aria-disabled')).toBe('true');
    expect(document.activeElement).toBe(retry);
    retry?.click();
    todayRequest().flush(apiError('INTERNAL_ERROR'), { status: 500, statusText: 'Error' });
    harness.detectChanges();
    expect(button()).toBe(retry);
    expect(retry?.getAttribute('aria-disabled')).toBeNull();
    expect(document.activeElement).toBe(retry);

    retry?.click();
    TestBed.tick();
    todayRequest().flush({ data: sampleTrackWithEditorial });
    harness.detectChanges();
    for (const copy of [
      sampleTrack.title,
      sampleTrack.artist,
      sampleTrack.album,
      String(sampleTrack.releaseYear),
      sampleTrackWithEditorial.description,
    ]) {
      expect(text()).toContain(copy);
    }
    expect(harness.routeNativeElement?.querySelector('img')?.getAttribute('src')).toBe(
      sampleTrackWithEditorial.coverUrl,
    );
    expect(harness.routeNativeElement?.querySelector('time')?.textContent?.trim()).toBe(
      'January 1, 2027',
    );
    const spotify = harness.routeNativeElement?.querySelector('a[target="_blank"]');
    expect(spotify?.getAttribute('href')).toBe(sampleTrack.spotifyUrl);
    expect(spotify?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(spotify?.textContent).toContain('se abre en otra pestaña');
    expect(document.activeElement).toBe(harness.routeNativeElement?.querySelector('h1'));
  });

  it('distinguishes an invalid route date from an unpublished selection', async () => {
    await harness.navigateByUrl('/tracks/2027-02-30');
    expect(text()).toContain('La fecha no es válida');
    http.expectNone(() => true);

    await harness.navigateByUrl('/tracks/2027-01-02');
    http
      .expectOne((req) => req.url.endsWith('/2027-01-02'))
      .flush(apiError('TRACK_NOT_FOUND'), {
        status: 404,
        statusText: 'Not Found',
      });
    harness.detectChanges();
    expect(text()).toContain('No hay canción para esta fecha');
    expect(harness.routeNativeElement?.querySelector('a[href="/history"]')).toBeTruthy();
  });

  it('cancels pending requests in both directions between today and historical detail', async () => {
    await harness.navigateByUrl('/');
    const today = http.expectOne((req) => req.url.endsWith('/today'));

    await harness.navigateByUrl('/tracks/2027-01-01');
    expect(today.cancelled).toBe(true);
    const detail = http.expectOne((req) => req.url.endsWith('/2027-01-01'));

    await harness.navigateByUrl('/');
    expect(detail.cancelled).toBe(true);
    http.expectOne((req) => req.url.endsWith('/today')).flush({ data: sampleTrack });
    harness.detectChanges();
    expect(text()).toContain(sampleTrack.title);
  });

  it('updates a reused date route and cancels the previous request', async () => {
    await harness.navigateByUrl('/tracks/2027-01-01');
    const first = http.expectOne((req) => req.url.endsWith('/2027-01-01'));
    await harness.navigateByUrl('/tracks/2027-01-02');
    expect(first.cancelled).toBe(true);
    http
      .expectOne((req) => req.url.endsWith('/2027-01-02'))
      .flush({ data: { ...sampleTrack, date: '2027-01-02', title: 'Second track' } });
    harness.detectChanges();
    expect(text()).toContain('Second track');
    expect(text()).not.toContain('Por qué esta canción');
    expect(harness.routeNativeElement?.querySelector('app-album-cover img')).toBeNull();
    expect(harness.routeNativeElement?.querySelector('app-album-cover [role="img"]')).toBeTruthy();
  });

  it('appends history in received order, ignores duplicate dates and retains rows on error', async () => {
    const newest = { ...sampleTrack, date: '2027-01-03', title: 'Newest' };
    const middle = { ...sampleTrack, date: '2027-01-02', title: 'Middle' };

    await harness.navigateByUrl('/history');
    expect(text()).toContain('Cargando el historial');
    historyRequest().flush(historyBody([newest, middle], 'opaque-cursor'));
    harness.detectChanges();
    expect(historyDates()).toEqual([newest.date, middle.date]);
    expect(
      harness.routeNativeElement
        ?.querySelector('app-history-page section ul time')
        ?.querySelector('[aria-hidden=true]')
        ?.textContent?.trim(),
    ).toBe('03');

    const loadMore = button();
    expect(loadMore?.textContent).toContain('Cargar más canciones');
    loadMore?.click();
    loadMore?.click();
    const pending = historyRequest('opaque-cursor');
    harness.detectChanges();
    expect(historyDates()).toEqual([newest.date, middle.date]);
    expect(text()).toContain('Cargando más canciones');
    pending.flush(apiError('INTERNAL_ERROR'), { status: 500, statusText: 'Error' });
    harness.detectChanges();
    expect(text()).toContain('No se pudieron cargar más canciones');
    expect(historyDates()).toEqual([newest.date, middle.date]);

    button()?.click();
    historyRequest('opaque-cursor').flush(historyBody([middle, sampleTrack, sampleTrack]));
    harness.detectChanges();
    expect(historyDates()).toEqual([newest.date, middle.date, sampleTrack.date]);
    expect(text()).toContain('Llegaste al final');
    expect(button()).toBeNull();

    const detailLink = harness.routeNativeElement?.querySelector('a[href="/tracks/2027-01-01"]');
    expect(detailLink).toBeTruthy();
    await harness.navigateByUrl(detailLink!.getAttribute('href')!);
    http.expectOne((req) => req.url.endsWith('/2027-01-01')).flush({ data: sampleTrack });
    harness.detectChanges();
    expect(text()).toContain(sampleTrack.title);
    expect(harness.routeNativeElement?.querySelector('a[href="/history"]')).toBeTruthy();
  });

  it('keeps a month together across cursors and opens the next civil month in order', async () => {
    const track = (date: string) => ({ ...sampleTrack, date });
    const months = () =>
      Array.from(
        harness.routeNativeElement?.querySelectorAll('section[aria-labelledby^="month-"]') ?? [],
        (section) => [
          section.getAttribute('aria-labelledby'),
          Array.from(section.querySelectorAll('time'), (date) => date.dateTime),
        ],
      );

    await harness.navigateByUrl('/history');
    historyRequest().flush(historyBody([track('2027-03-02')], 'march'));
    harness.detectChanges();
    expect(months()).toEqual([['month-2027-03', ['2027-03-02']]]);

    button()?.click();
    historyRequest('march').flush(
      historyBody([track('2027-03-02'), track('2027-03-01'), track('2027-02-28')]),
    );
    harness.detectChanges();
    expect(months()).toEqual([
      ['month-2027-03', ['2027-03-02', '2027-03-01']],
      ['month-2027-02', ['2027-02-28']],
    ]);
    expect(text()).toContain('Se agregaron 2 canciones.');
  });

  it('renders an empty history with no continuation', async () => {
    await harness.navigateByUrl('/history');
    historyRequest().flush(historyBody([]));
    harness.detectChanges();
    expect(text()).toContain('Todavía no hay canciones publicadas');
    expect(harness.routeNativeElement?.querySelector('.history-playlists')).toBeNull();
    expect(historyDates()).toEqual([]);
    expect(button()).toBeNull();
  });

  it('announces the end when the last cursor returns no publications', async () => {
    await harness.navigateByUrl('/history');
    historyRequest().flush(historyBody([], 'next'));
    harness.detectChanges();
    expect(button()?.textContent).toContain('Cargar más canciones');

    button()?.click();
    historyRequest('next').flush(historyBody([]));
    harness.detectChanges();
    expect(button()).toBeNull();
    expect(text()).toContain('Todavía no hay canciones publicadas');
    expect(text()).toContain('Llegaste al final del historial.');
  });

  it('retries an initial history error through the same control until it succeeds', async () => {
    await harness.navigateByUrl('/history');
    historyRequest().flush(apiError('INTERNAL_ERROR'), { status: 500, statusText: 'Error' });
    harness.detectChanges();
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain(
      'No pudimos cargar el historial',
    );

    const retry = button();
    retry?.click();
    harness.detectChanges();
    expect(button()).toBe(retry);
    expect(button()?.getAttribute('aria-disabled')).toBe('true');
    retry?.click();
    historyRequest().flush(historyBody([sampleTrack]));
    harness.detectChanges();
    expect(button()).toBeNull();
    expect(historyDates()).toEqual([sampleTrack.date]);
  });

  it('shows configured annual Spotify playlists only in history', async () => {
    const url = 'https://open.spotify.com/playlist/0123456789abcdefghijkl';
    const nextUrl = 'https://open.spotify.com/playlist/abcdefghijkl0123456789';
    Object.assign(environment, {
      spotifyPlaylists: {
        '2027': url + '?si=sharing-token',
        '2028': nextUrl,
        '2029': url.replace('/playlist/', '/track/'),
        '2030': url.replace('open.spotify.com', 'open.spotify.com.example.test'),
        '2031': url.replace('https:', 'http:'),
        '2032': 'https://open.spotify.com/playlist/REPLACE_ME',
        '2033': url.replace('open.spotify.com', 'name:password@open.spotify.com'),
        '2034': ' ',
      },
    });

    await harness.navigateByUrl('/history');
    historyRequest().flush(historyBody([sampleTrack]));
    harness.detectChanges();
    const links = Array.from(
      harness.routeNativeElement?.querySelectorAll('.history-playlists a') ?? [],
    );
    expect(links.map((link) => link.getAttribute('href'))).toEqual([nextUrl, url]);
    expect(links[0]?.textContent).toContain('Playlist 2028 en Spotify');
    expect(links[1]?.textContent).toContain('Playlist 2027 en Spotify');
    for (const link of links) {
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
      expect(link.textContent).toContain('se abre en otra pestaña');
    }
    expect(text()).toContain('Las canciones pueden tardar en aparecer en Spotify');

    await harness.navigateByUrl('/');
    http.expectOne((req) => req.url.endsWith('/today')).flush({ data: sampleTrack });
    harness.detectChanges();
    expect(text()).toContain(sampleTrack.title);
    expect(harness.routeNativeElement?.querySelectorAll('a[target="_blank"]')).toHaveLength(1);
    expect(
      harness.routeNativeElement?.querySelector('a[target="_blank"]')?.getAttribute('href'),
    ).toBe(sampleTrack.spotifyUrl);
  });

  it('keeps external Spotify links out of fixture mode', async () => {
    Object.assign(environment, {
      fixtures: true,
      spotifyPlaylists: { '2027': 'https://open.spotify.com/playlist/0123456789abcdefghijkl' },
    });

    await harness.navigateByUrl('/history');
    historyRequest().flush(historyBody([sampleTrack]));
    harness.detectChanges();
    expect(harness.routeNativeElement?.querySelector('.history-playlists')).toBeNull();

    await harness.navigateByUrl('/');
    http.expectOne((req) => req.url.endsWith('/today')).flush({ data: sampleTrack });
    harness.detectChanges();
    expect(text()).toContain(sampleTrack.title);
    expect(harness.routeNativeElement?.querySelector('a[target="_blank"]')).toBeNull();
  });

  it('cancels a pending history page on navigation and starts over on return', async () => {
    await harness.navigateByUrl('/history');
    historyRequest().flush(historyBody([sampleTrack], 'opaque-cursor'));
    harness.detectChanges();
    button()?.click();
    const pending = historyRequest('opaque-cursor');

    await harness.navigateByUrl('/unknown');
    expect(text()).toContain('404');
    expect(pending.cancelled).toBe(true);

    await harness.navigateByUrl('/history');
    historyRequest().flush(historyBody([]));
    harness.detectChanges();
    expect(historyDates()).toEqual([]);
  });
});
