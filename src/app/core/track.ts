export interface Track {
  readonly date: string;
  readonly title: string;
  readonly artist: string;
  readonly album: string;
  readonly coverUrl: string;
  readonly spotifyUrl: string | null;
  readonly description: string;
}

export interface TrackPage {
  readonly items: readonly Track[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

export function isPublicationDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isImageUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  return (
    value.startsWith('/fixtures/') || (URL.canParse(value) && new URL(value).protocol === 'https:')
  );
}

function isSpotifyUrl(value: unknown): boolean {
  if (value === null) return true;
  if (typeof value !== 'string' || !URL.canParse(value)) return false;
  const url = new URL(value);
  return (
    url.protocol === 'https:' &&
    url.hostname === 'open.spotify.com' &&
    /^\/track\/[A-Za-z0-9]{22}$/.test(url.pathname) &&
    !url.username &&
    !url.password
  );
}

export function parseTrack(value: unknown): Track {
  if (
    !isRecord(value) ||
    !['title', 'artist', 'album', 'description'].every(
      (field) => typeof value[field] === 'string' && value[field].trim().length > 0,
    ) ||
    typeof value['date'] !== 'string' ||
    !isPublicationDate(value['date']) ||
    !isImageUrl(value['coverUrl']) ||
    !isSpotifyUrl(value['spotifyUrl'])
  ) {
    throw new Error('Invalid track response');
  }
  return value as unknown as Track;
}

export function parseTrackPage(value: unknown): TrackPage {
  if (
    !isRecord(value) ||
    !Array.isArray(value['items']) ||
    !['page', 'pageSize', 'total'].every((key) => Number.isSafeInteger(value[key])) ||
    (value['page'] as number) < 1 ||
    (value['pageSize'] as number) < 1 ||
    (value['total'] as number) < 0 ||
    value['items'].length > (value['pageSize'] as number)
  ) {
    throw new Error('Invalid history response');
  }
  return {
    items: value['items'].map(parseTrack),
    page: value['page'] as number,
    pageSize: value['pageSize'] as number,
    total: value['total'] as number,
  };
}
