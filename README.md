# 365 Tracks

[Español](README.es.md)

Public music discovery frontend: one shared daily song, a short selection note, Spotify links and a chronological archive. Selections begin January 1, 2027. The working name and visual styling are provisional.

## Development

Use Node.js from `.nvmrc` and npm 11.

```sh
nvm use
npm ci
npm start
```

Open `http://localhost:4200`. The default development environment calls `http://localhost:3000/api` and requires the independent `365-tracks-api` backend with CORS enabled for the frontend origin.

```sh
npm run start:fixtures
```

This separate local mode intercepts the three track endpoints. Its invented songs, dates and original sample artwork are labeled as a demonstration. They have no Spotify links. Fixtures and their assets are excluded from the production build.

```sh
npm run lint
npm run format:check
npm test
npm run build
```

`npm run format` formats sources; `npm run test:watch` starts watch mode. GitHub Actions runs lint, formatting, unit tests and the production build without deployment.

## Architecture

Angular 22 standalone, strict TypeScript, SCSS, lazy Angular Router routes and HttpClient. Readonly signals expose view state; computed derives values. RxJS combines route changes and retries, cancels obsolete HTTP requests and converts responses to readonly signals. Components use OnPush and inject(). No component library, SSR, audio player or browser SDK integrations.

| Route             | View                                              |
| ----------------- | ------------------------------------------------- |
| `/`               | Daily song, loading, error and unpublished states |
| `/history?page=1` | Newest-first archive, 12 songs per page           |
| `/tracks/:date`   | Date-specific song or unpublished state           |

`src/app/core` owns the typed API boundary and response validation; `pages` owns routed views; `shared` owns the album cover and full song presentation. `src/app/dev` and `dev-assets` contain local-only fixtures. System color preference controls light/dark themes. Date-only values are rendered in UTC to avoid a previous-day display in negative time zones. The backend determines the shared publication day.

## API configuration and contract

Set `apiBaseUrl` in `src/environments/environment.ts` before building production; its `https://api.example.com/api` value is a placeholder. Development replaces this file with `environment.development.ts`; fixtures use `environment.fixtures.ts` and replace the otherwise empty fixture providers. Additional environments can use Angular file replacements. These values are public build-time configuration, never secrets; hosting environment variables are not automatically injected into the browser bundle.

The following is a proposed integration contract to agree with `365-tracks-api`:

- `GET {apiBaseUrl}/tracks/today` and `GET {apiBaseUrl}/tracks/YYYY-MM-DD` return a `Track`, `null`, or HTTP 404 for an unpublished day. Other failures show a retry action.
- `GET {apiBaseUrl}/tracks?page=1&pageSize=12` returns `{ items: Track[], page: number, pageSize: number, total: number }`. Pages are one-based; `total` counts archive items. The backend returns previous publications in descending date order and excludes today's song.
- `Track` has `date`, `title`, `artist`, `album`, `coverUrl`, `spotifyUrl` and `description`. `date` is a real calendar date in `YYYY-MM-DD`; text fields are nonempty; `coverUrl` is an absolute HTTPS URL. The API must not expose unpublished selections. The backend owns the publication timezone and launch schedule.
- `spotifyUrl` is an HTTPS `open.spotify.com/track/{22-character-id}` link; `null` means no link is available. Local fixtures use a relative `/fixtures/` cover and no listening link.

Malformed responses show an error instead of displaying partial songs. Spotify links open a separate tab. The frontend makes no API calls to Spotify, OpenAI or X/Twitter.

## Cloudflare Pages

Build as a static SPA with `npm run build`. The output directory is `dist/365-tracks/browser`. Configure Node.js to match `.nvmrc`; point the API environment at the real backend and allow the frontend origin through backend CORS. Angular's root `index.html` and the absence of a root `404.html` allow Cloudflare Pages' native SPA fallback to serve deep routes. `public/_headers` supplies basic response headers.

No Cloudflare account, Pages project, production deployment or automatic deployment is configured. When hosting is authorized, upload the static build with Direct Upload if automatic Git deployments are not wanted.

Reference: [Angular compatibility](https://angular.dev/reference/versions), [Cloudflare Angular](https://developers.cloudflare.com/pages/framework-guides/deploy-an-angular-site/), [Pages SPA routing](https://developers.cloudflare.com/pages/configuration/serving-pages/#single-page-application-spa-rendering).
