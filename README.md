# Daywave

[![CI](https://img.shields.io/github/actions/workflow/status/matigaleanodev/365-tracks/ci.yml?style=flat-square&label=CI)](https://github.com/matigaleanodev/365-tracks/actions/workflows/ci.yml)
![Version](https://img.shields.io/badge/version-0.0.0-blue?style=flat-square)
![Angular](https://img.shields.io/badge/Angular-22-DD0031?style=flat-square&logo=angular&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?style=flat-square&logo=cloudflare&logoColor=white)

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

This separate local mode intercepts the three track endpoints. Its invented songs, dates and original sample artwork are labeled as a demonstration. The demo hides its fictional Spotify links and includes tracks with and without artwork and editorial notes. Open `/?fixture=empty` or `/history?fixture=empty` to see unpublished and empty states, and `/?fixture=prelaunch` to preview prelaunch regardless of the device date (fixture mode otherwise ignores the launch date). Use `?fixture=error` on the route to simulate HTTP 500. Fixtures and their assets are excluded from the production build.

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

`npm run build` reads the public production values from [`deploy/production.json`](deploy/production.json): `apiBaseUrl` is the public HTTPS URL of the backend stack output `ApiUrl`, including its stage path if present, with `/api` appended. The build validates the file and passes it to Angular through a temporary environment file. Development and fixtures keep their separate file replacements.

The frontend consumes the `365-tracks-api` contract:

- `GET {apiBaseUrl}/tracks/today?timezone=...` and `GET {apiBaseUrl}/tracks/YYYY-MM-DD?timezone=...` return `{ data: Track }`. HTTP 404 with `TRACK_NOT_FOUND` means the selection has not been published.
- `GET {apiBaseUrl}/tracks?timezone=...&limit=30&cursor=...` returns `{ data: Track[], pagination: { limit, nextCursor } }`. Omit `cursor` on the first request and send the opaque `nextCursor` unchanged when loading more. `null` marks the end of the newest-first history.
- `Track` requires `date`, `title`, `artist`, `album`, `releaseYear`, `spotifyTrackId`, `spotifyUrl`, `selectionCriterion` and `createdAt`. `coverUrl` and `description` may be omitted.
- API errors have the shape `{ error: { code, message, requestId? } }`. Unexpected failures and malformed success responses show a retry action.

The frontend sends the IANA time zone reported by the browser or `UTC` if detection fails. The API determines publication visibility and supplies the date shown with each track. On the home page, a local date change triggers a fresh `/tracks/today` request, including after returning to a hidden tab. If the API still returns an older date or `TRACK_NOT_FOUND`, the home page can retry within the first two minutes of the local day.

Before 2027-01-01 in the visitor's local calendar, the home page shows the prelaunch view without requesting `/tracks/today`. The first request happens at local midnight on launch day, even if the page stays open, or when a hidden tab becomes visible again. A device clock running behind keeps the prelaunch view for as long as it lags. This is the only case where the device clock decides what the page shows; after launch, the API determines the edition. From then on, `TRACK_NOT_FOUND` is a waiting state ("no song today yet"), while any other failure, including a 404 without that code, shows the retry state.

The visitor clock schedules these checks. With a slow clock, the refresh can lag by the amount of the clock skew. Exact timing requires an API clock or a next-publication timestamp readable on both success and `TRACK_NOT_FOUND`. A gateway's HTTP `Date` header is unavailable to cross-origin JavaScript unless CORS explicitly exposes it.

## Spotify archive

`spotifyPlaylists` in [`deploy/production.json`](deploy/production.json) maps years starting with `2027` to public `https://open.spotify.com/playlist/` URLs. Add each playlist once it is public. History displays the links newest year first in separate tabs and hides the section when the object is empty. Fixture mode always hides it.

The playlist is updated outside Angular. A track can appear in the app's history before Spotify adds it, since the playlist waits for the publication date to end in every time zone. The daily song has its own Spotify track link. Neither the playlist nor synchronization requires a new public API endpoint.

## Publishing

The site is served by Cloudflare Workers with static assets at `https://daywave.matiasgaleano.dev`. `npm run preview` builds for production, verifies the output and serves it locally with Wrangler. Merging a release into `main` deploys automatically and publishes its tag and release. [Deployment guide](DEPLOYMENT.md) covers the Workers setup, public values, secrets, initial setup, rollback and the custom domain.

Sharing metadata (title, description, Open Graph and the social card) is part of `src/index.html`, so link previews work without JavaScript. Since every route receives the same HTML, the canonical URL is declared per route on navigation and the 404 page is marked `noindex`. `public/robots.txt` and `public/sitemap.xml` list the public routes. Brand PNGs are generated from `public/daywave-mark.svg` with `bash scripts/brand-assets.sh`.
