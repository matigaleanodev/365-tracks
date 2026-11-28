# Deploying to Cloudflare Workers

[Español](DEPLOYMENT.es.md)

Daywave is published as a Worker with static assets at `https://daywave.matiasgaleano.dev`. The configuration lives in [`wrangler.jsonc`](wrangler.jsonc) and the public build values in [`deploy/production.json`](deploy/production.json).

## How it is served

- `npm run build` produces `dist/365-tracks/browser`, which Wrangler uploads as assets. Cloudflare serves them without running code: static asset requests are free and do not count against the free plan's requests.
- [`worker/index.js`](worker/index.js) only receives what the assets do not resolve. `not_found_handling` is not set, so every request that matches no asset reaches it, browser navigations included, and follows the same rules: extensionless Angular routes (`/history`, `/tracks/YYYY-MM-DD`) get `index.html` with status 200, for browsers, link previewers and crawlers alike, including reloads; missing files, such as a chunk from a previous version, get an uncached 404, even when opened from the address bar. A missing chunk is never stored as HTML with immutable caching. It has no state and only uses the assets binding. Requests that reach it, such as opening `/history` directly, count against the Workers plan (the free plan includes 100,000 a day); the home page, assets and in-app navigation do not. If the daily limit is used up, direct loads of deep links fail until the next day, while the home page and assets keep working.
- A single public origin: `workers_dev` and `preview_urls` are disabled.
- [`public/_headers`](public/_headers) defines security headers and caching: Angular hashed files (`*.js`, `*.css`) are immutable for a year, fonts and images are cached for a week, and `index.html`, `robots.txt`, `sitemap.xml` and the manifest keep the Workers default (`public, max-age=0, must-revalidate` with ETag), so every deployment shows immediately. Workers sets MIME types by extension.

## Public values

[`deploy/production.json`](deploy/production.json) is the only source for the production build and ends up in the browser bundle. It holds no secrets.

| Key                | Use                                                                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `siteUrl`          | Public origin. The build checks that it matches `wrangler.jsonc`, the Open Graph image in `src/index.html`, `robots.txt` and `sitemap.xml`. |
| `apiBaseUrl`       | HTTPS URL of the `365-tracks-api` `ApiUrl` output, ending in `/api`.                                                                        |
| `spotifyPlaylists` | Years from 2027 and public `https://open.spotify.com/playlist/<id>` URLs. A new year is a reviewed change to this file.                     |

`npm run build:check` uses an isolated validation URL and does not read this file.

## Secrets

Only the deployment workflow uses credentials, as secrets of the GitHub `production` environment, restricted to `main` and without reviewers: the authorized release merge is the approval.

| Secret                  | Value                                                                                                                                                                                                                                                                                                             |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID of the Cloudflare account that holds the `matiasgaleano.dev` zone.                                                                                                                                                                                                                                     |
| `CLOUDFLARE_API_TOKEN`  | Custom token with **Account › Workers Scripts › Edit** on that account plus **Zone › Workers Routes › Edit** and **Zone › Zone › Read** on the `matiasgaleano.dev` zone only (the read lets the custom domain resolve the zone). No other permissions or zones. Set an expiry and rotate it with the same script. |

## Initial setup

1. Check that the `matiasgaleano.dev` zone is active in Cloudflare and that `daywave` has no existing CNAME record: the Workers custom domain creates the record and the certificate.
2. Create the token above in **My Profile › API Tokens › Create Token › Custom token**.
3. From WSL, at the repository root, run `bash scripts/setup-github-secrets.sh`. It creates or adjusts the `production` environment (`main` only, no reviewers) and asks for both values without echo.
4. Publish the backend first with the site origin in CORS (see [Backend dependencies](#backend-dependencies)).
5. Merge a `release/x.x.x` into `main`, with the `package.json` `version` set to `x.x.x` (CI enforces it on the pull request). The first deployment creates the `daywave` Worker and its domain.

## Automatic deployment

[`deploy.yml`](.github/workflows/deploy.yml) runs when changes land on `main` and, as a fallback, manually from `main`, without inputs:

1. Installs, validates (lint, format, tests), builds with `deploy/production.json` and verifies the output (`npm run verify:dist`: no fixtures, source maps or secrets, with the expected metadata and configuration).
2. Checks that the production API accepts the site origin through CORS (`scripts/verify-api-cors.mjs`) and stops before publishing otherwise.
3. Publishes with `wrangler deploy`, using the commit as the version message.
4. Verifies the published site with `scripts/verify-site.mjs` (deep routes, file 404s, MIME types, caching, metadata without JavaScript and API CORS for the domain), retrying for about 5 minutes while the first certificate is issued. If verification fails after the site is published, fix the cause and rerun the workflow: deployment is idempotent and `release` runs once verification passes.
5. The `release` job creates the `v<package.json version>` tag and GitHub release with generated notes when they do not exist yet. Version `0.0.0` is not published.

[`ci.yml`](.github/workflows/ci.yml) validates every pull request to `dev` and `main` without credentials, and checks that a `release/x.x.x` sets that `package.json` version: lint, format, tests, production build, output verification, `wrangler deploy --dry-run` and the local preview with `verify-site`. [`branch-policy.yml`](.github/workflows/branch-policy.yml) enforces the branch flow.

## Local validation and preview

```sh
npm run preview          # production build, verify:dist and wrangler dev at http://127.0.0.1:8787
npm run verify:site      # in another terminal, against the preview
node scripts/verify-site.mjs https://daywave.matiasgaleano.dev   # against the published site
```

The preview uses the real API. The backend must allow the browser origin through CORS: the local preview (`http://127.0.0.1:8787`) is not on the production list, so locally the API only answers flows that forward the requests.

## Rollback

- **Previous Worker version:** `npx wrangler deployments list` and `npx wrangler rollback [version-id]` with `wrangler login` or a token holding the permissions above, or **Workers & Pages › daywave › Deployments › Rollback** in the dashboard. It is immediate and needs no build.
- **Lasting fix:** a new `release/x.x.x` to `main` with the fix or revert. The next automatic deployment replaces a manual rollback.
- Each version publishes its full set of assets, so rolling back never mixes files.

## Subdomain

`routes` declares `daywave.matiasgaleano.dev` as a custom domain (`custom_domain: true`). Cloudflare manages the DNS record and the certificate. To remove it, delete the entry and deploy, or remove it in **Workers & Pages › daywave › Settings › Domains & Routes**. No additional domain is used.

## Backend dependencies

- `corsAllowedOrigins` in `365-tracks-api` (`deploy/production.json`) must include `https://daywave.matiasgaleano.dev`, without a trailing slash.
- If the API URL changes, update `apiBaseUrl` and publish a frontend release.
