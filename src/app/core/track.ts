export interface Track {
  readonly date: string;
  readonly title: string;
  readonly artist: string;
  readonly album: string;
  readonly releaseYear: number;
  readonly spotifyTrackId: string;
  readonly spotifyUrl: string;
  readonly selectionCriterion: string;
  readonly createdAt: string;
  readonly coverUrl?: string;
  readonly description?: string;
}

export interface TrackResponse {
  readonly data: Track;
}

export interface TrackListResponse {
  readonly data: readonly Track[];
  readonly pagination: {
    readonly limit: number;
    readonly nextCursor: string | null;
  };
}

export interface ErrorResponse {
  readonly error: {
    readonly code:
      | 'INVALID_DATE'
      | 'INVALID_QUERY_PARAMETER'
      | 'TRACK_NOT_FOUND'
      | 'ROUTE_NOT_FOUND'
      | 'INTERNAL_ERROR';
    readonly message: string;
    readonly requestId?: string;
  };
}

export function isPublicationDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isImageUrl(value: unknown, fixtures: boolean): boolean {
  return (
    typeof value === 'string' &&
    ((fixtures && value.startsWith('/fixtures/')) ||
      (URL.canParse(value) && new URL(value).protocol === 'https:'))
  );
}

function isSpotifyUrl(value: unknown): boolean {
  if (typeof value !== 'string' || !URL.canParse(value)) return false;
  const url = new URL(value);
  return (
    url.origin === 'https://open.spotify.com' &&
    /^\/track\/[A-Za-z0-9_-]+$/.test(url.pathname) &&
    !url.username &&
    !url.password
  );
}

function parseTrack(value: unknown, fixtures: boolean): Track {
  if (
    !isRecord(value) ||
    !['title', 'artist', 'album', 'spotifyTrackId', 'selectionCriterion'].every((field) =>
      isNonEmptyString(value[field]),
    ) ||
    typeof value['date'] !== 'string' ||
    !isPublicationDate(value['date']) ||
    !Number.isInteger(value['releaseYear']) ||
    !isSpotifyUrl(value['spotifyUrl']) ||
    typeof value['createdAt'] !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value['createdAt']) ||
    !isPublicationDate(value['createdAt'].slice(0, 10)) ||
    !Number.isFinite(Date.parse(value['createdAt'])) ||
    (value['coverUrl'] !== undefined && !isImageUrl(value['coverUrl'], fixtures)) ||
    (value['description'] !== undefined && typeof value['description'] !== 'string')
  ) {
    throw new Error('Invalid track response');
  }
  return value as unknown as Track;
}

export function parseTrackResponse(value: unknown, fixtures = false): TrackResponse {
  if (!isRecord(value)) throw new Error('Invalid track response');
  return { data: parseTrack(value['data'], fixtures) };
}

export function parseTrackListResponse(value: unknown, fixtures = false): TrackListResponse {
  if (!isRecord(value) || !Array.isArray(value['data']) || !isRecord(value['pagination'])) {
    throw new Error('Invalid history response');
  }
  const { limit, nextCursor } = value['pagination'];
  if (
    typeof limit !== 'number' ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100 ||
    value['data'].length > limit ||
    (nextCursor !== null && !isNonEmptyString(nextCursor))
  ) {
    throw new Error('Invalid history pagination');
  }
  return {
    data: value['data'].map((track) => parseTrack(track, fixtures)),
    pagination: { limit, nextCursor },
  };
}

export function hasApiErrorCode(value: unknown, code: ErrorResponse['error']['code']): boolean {
  if (!isRecord(value) || !isRecord(value['error'])) return false;
  const error = value['error'];
  return (
    error['code'] === code &&
    isNonEmptyString(error['message']) &&
    (error['requestId'] === undefined || typeof error['requestId'] === 'string')
  );
}
