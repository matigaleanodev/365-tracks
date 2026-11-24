# Daywave

[Español](README.es.md)

Public music discovery frontend: one shared daily song, a short selection note, Spotify links and a chronological archive. The [Daily Edition design](DESIGN.en.md) documents the brand and its assets.

## Development

Use Node.js from `.nvmrc` and npm 11.

```sh
nvm use
npm ci
npm start
```

Open `http://localhost:4200`. The development environment calls `http://localhost:3000/api`. Run `365-tracks-api` through an HTTP listener on port 3000 and allow the origin `http://localhost:4200` via CORS. To use another listener or a deployed API, set `apiBaseUrl` in `src/environments/environment.development.ts`. The backend command `npm run invoke` invokes the Lambda handler directly without starting a listener.

```sh
npm run start:fixtures
```

This separate local mode intercepts the three track endpoints. Its invented songs, dates and original sample artwork are labeled as a demonstration. The demo hides its fictional Spotify links and includes tracks with and without artwork and editorial notes. Open `/?fixture=empty` or `/history?fixture=empty` to see unpublished and empty states. Use `?fixture=error` on the route to simulate HTTP 500. Fixtures and their assets are excluded from the production build.

```sh
npm run lint
npm run format:check
npm test
npm run build:check
```

`npm run format` formats sources; `npm run test:watch` starts watch mode. GitHub Actions runs the same checks. `build:check` compiles the production configuration with an isolated validation URL and writes its output to `.tmp/production-check/browser`.

## Architecture

Angular 22 standalone, strict TypeScript, SCSS, lazy Angular Router routes and HttpClient. Readonly signals expose view state; computed derives values. RxJS combines route changes and retries, cancels obsolete HTTP requests and converts responses to readonly signals. Components use OnPush and inject(). No component library, SSR, audio player or browser SDK integrations.

| Route           | View                                              |
| --------------- | ------------------------------------------------- |
| `/`             | Daily song, loading, error and unpublished states |
| `/history`      | Newest-first archive with incremental loading     |
| `/tracks/:date` | Date-specific song or unpublished state           |

`src/app/core` owns the typed API boundary and response validation; `pages` owns routed views; `shared` owns the album cover and full song presentation. `src/app/dev` and `dev-assets` contain local-only fixtures. The theme selector follows the system by default and persists an explicit Light or Dark preference. Date-only values are rendered in UTC to avoid a previous-day display in negative time zones. The backend determines the shared publication day.

## API configuration and contract

Set `API_BASE_URL` to the public HTTPS URL from the backend stack output `ApiUrl`, including its stage path if present, and append `/api`. Run `npm run build` with that variable set. The build validates the URL and passes it to Angular through a temporary environment file. Development and fixtures keep their separate file replacements.

The frontend consumes the `365-tracks-api` contract:

- `GET {apiBaseUrl}/tracks/today?timezone=...` and `GET {apiBaseUrl}/tracks/YYYY-MM-DD?timezone=...` return `{ data: Track }`. HTTP 404 with `TRACK_NOT_FOUND` means the selection has not been published.
- `GET {apiBaseUrl}/tracks?timezone=...&limit=30&cursor=...` returns `{ data: Track[], pagination: { limit, nextCursor } }`. Omit `cursor` on the first request and send the opaque `nextCursor` unchanged when loading more. `null` marks the end of the newest-first history.
- `Track` requires `date`, `title`, `artist`, `album`, `releaseYear`, `spotifyTrackId`, `spotifyUrl`, `selectionCriterion` and `createdAt`. `coverUrl` and `description` may be omitted.
- API errors have the shape `{ error: { code, message, requestId? } }`. Unexpected failures and malformed success responses show a retry action.

The frontend sends the IANA time zone reported by the browser or `UTC` if detection fails. The API determines publication visibility and supplies the date shown with each track. On the home page, a local date change triggers a fresh `/tracks/today` request, including after returning to a hidden tab. If the API still returns an older date or `TRACK_NOT_FOUND`, the home page can retry within the first two minutes of the local day.

The visitor clock schedules these checks. With a slow clock, the refresh can lag by the amount of the clock skew. Exact timing requires an API clock or a next-publication timestamp readable on both success and `TRACK_NOT_FOUND`. A gateway's HTTP `Date` header is unavailable to cross-origin JavaScript unless CORS explicitly exposes it.

## Spotify archive

Set `SPOTIFY_PLAYLISTS` at build time to a JSON object whose keys are years starting with `2027` and whose values are the corresponding public `https://open.spotify.com/playlist/` URLs with their playlist IDs. Add each playlist once it is public. History displays the links newest year first in separate tabs. Omit the variable or use `{}` to hide the section. Fixture mode always hides it.

The playlist is updated outside Angular. A track can appear in the app's history before Spotify adds it, since the playlist waits for the publication date to end in every time zone. The daily song has its own Spotify track link. Neither the playlist nor synchronization requires a new public API endpoint.

## Cloudflare Pages

Use `npm run build` and publish `dist/365-tracks/browser`. Set Node.js to match `.nvmrc`, provide the required `API_BASE_URL` and optionally set `SPOTIFY_PLAYLISTS` in the build environment. Both values are bundled into browser code and must contain only public URLs. For Direct Upload, set the same variables in the local shell running the build. To preview locally, serve the build output with a static server that falls back to `index.html` for app routes.

Add the exact public frontend origin to the backend's `CORS_ALLOWED_ORIGINS` once the domain is chosen. Use `https://<frontend-domain>` with a port only if needed, and omit paths and the trailing slash. If both a custom domain and a `pages.dev` hostname are used, list their origins separately. Angular's root `index.html` and the absence of a root `404.html` enable the Pages SPA fallback for deep routes. `public/_headers` supplies response headers.

Reference: [Angular compatibility](https://angular.dev/reference/versions), [Cloudflare Angular](https://developers.cloudflare.com/pages/framework-guides/deploy-an-angular-site/), [Pages SPA routing](https://developers.cloudflare.com/pages/configuration/serving-pages/#single-page-application-spa-rendering).
