import type { ErrorResponse, Track } from '../core/track';

export const sampleTrack = {
  date: '2027-01-01',
  title: 'Test track',
  artist: 'Test artist',
  album: 'Test album',
  releaseYear: 1999,
  spotifyTrackId: '1234567890123456789012',
  spotifyUrl: 'https://open.spotify.com/track/1234567890123456789012',
  selectionCriterion: 'test',
  createdAt: '2027-01-01T00:00:00.000Z',
} as const satisfies Track;

export const sampleTrackWithEditorial = {
  ...sampleTrack,
  coverUrl: 'https://example.com/cover.webp',
  description: 'Test selection only.',
} as const satisfies Track;

export function apiError(code: ErrorResponse['error']['code']): ErrorResponse {
  return { error: { code, message: 'Test API error', requestId: 'test-request' } };
}
