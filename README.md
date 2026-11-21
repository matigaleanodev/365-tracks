# 365 Tracks

[Español](README.es.md)

Public music discovery frontend: one shared daily song, a short selection note, Spotify links and a chronological archive. The working name and visual styling are provisional.

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
npm run build
```

`npm run format` formats sources; `npm run test:watch` starts watch mode. GitHub Actions runs lint, formatting, unit tests and the production build without deployment.

## Architecture

Angular 22 standalone, strict TypeScript, SCSS, lazy Angular Router routes and HttpClient. Readonly signals expose view state; computed derives values. RxJS combines route changes and retries, cancels obsolete HTTP requests and converts responses to readonly signals. Components use OnPush and inject(). No component library, SSR, audio player or browser SDK integrations.

| Route           | View                                              |
| --------------- | ------------------------------------------------- |
| `/`             | Daily song, loading, error and unpublished states |
| `/history`      | Newest-first archive with incremental loading     |
| `/tracks/:date` | Date-specific song or unpublished state           |

`src/app/core` owns the typed API boundary and response validation; `pages` owns routed views; `shared` owns the album cover and full song presentation. `src/app/dev` and `dev-assets` contain local-only fixtures. System color preference controls light/dark themes. Date-only values are rendered in UTC to avoid a previous-day display in negative time zones. The backend determines the shared publication day.

## API configuration and contract

Set `apiBaseUrl` in `src/environments/environment.ts` before building production; use the stage URL from the backend stack output `ApiUrl` and append `/api` (for example, `https://<api-id>.execute-api.<region>.amazonaws.com/api` for the default stage). Development replaces this file with `environment.development.ts`; fixtures use `environment.fixtures.ts` and replace the otherwise empty fixture providers. Additional environments can use Angular file replacements. These values are public build-time configuration, never secrets; hosting environment variables are not automatically injected into the browser bundle.

The frontend consumes the `365-tracks-api` contract:

- `GET {apiBaseUrl}/tracks/today?timezone=...` and `GET {apiBaseUrl}/tracks/YYYY-MM-DD?timezone=...` return `{ data: Track }`. HTTP 404 with `TRACK_NOT_FOUND` means the selection has not been published.
- `GET {apiBaseUrl}/tracks?timezone=...&limit=30&cursor=...` returns `{ data: Track[], pagination: { limit, nextCursor } }`. Omit `cursor` on the first request and send the opaque `nextCursor` unchanged when loading more. `null` marks the end of the newest-first history.
- `Track` requires `date`, `title`, `artist`, `album`, `releaseYear`, `spotifyTrackId`, `spotifyUrl`, `selectionCriterion` and `createdAt`. `coverUrl` and `description` may be omitted.
- API errors have the shape `{ error: { code, message, requestId? } }`. Unexpected failures and malformed success responses show a retry action.

The frontend sends the IANA time zone reported by the browser or `UTC` if detection fails. On the home page, a local date change triggers a fresh `/tracks/today` request, including after returning to a hidden tab. The API determines publication visibility and supplies the date shown with each track.

## Spotify archive

In the target environment file, add the public Spotify playlist URL to `spotifyPlaylists` under its year, starting with `2027`. Set it once the playlist is publicly accessible. Add later years to the same map. History displays valid HTTPS Spotify playlist links newest year first, in separate tabs. Leave the map empty to hide the section. Fixture mode always hides it.

The playlist is updated outside Angular. A track can appear in the app's history before Spotify adds it, since the playlist waits for the publication date to end in every time zone. The daily song has its own Spotify track link. Neither the playlist nor synchronization requires a new public API endpoint.

## Cloudflare Pages

Build as a static SPA with `npm run build`. The output directory is `dist/365-tracks/browser`. Configure Node.js to match `.nvmrc`; point the API environment at the real backend and allow the frontend origin through backend CORS. Angular's root `index.html` and the absence of a root `404.html` allow Cloudflare Pages' native SPA fallback to serve deep routes. `public/_headers` supplies basic response headers.

No Cloudflare account, Pages project, production deployment or automatic deployment is configured. When hosting is authorized, upload the static build with Direct Upload if automatic Git deployments are not wanted.

Reference: [Angular compatibility](https://angular.dev/reference/versions), [Cloudflare Angular](https://developers.cloudflare.com/pages/framework-guides/deploy-an-angular-site/), [Pages SPA routing](https://developers.cloudflare.com/pages/configuration/serving-pages/#single-page-application-spa-rendering).
