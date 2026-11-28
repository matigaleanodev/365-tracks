import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

function apiBaseUrl(value) {
  const url = URL.canParse(value) ? new URL(value) : null;
  if (
    !url ||
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !url.hostname.includes('.') ||
    /(?:^|\.)(?:example\.(?:com|net|org)|example|invalid|localhost|test)\.?$/.test(url.hostname) ||
    !url.pathname.replace(/\/$/, '').endsWith('/api')
  ) {
    throw new Error('apiBaseUrl must be a public HTTPS URL ending in /api.');
  }
  return url.origin + url.pathname.replace(/\/$/, '');
}

function spotifyPlaylists(value = '{}') {
  let playlists;
  try {
    playlists = JSON.parse(value);
  } catch {
    throw new Error('spotifyPlaylists must be an object of years and Spotify playlist URLs.');
  }
  if (!playlists || typeof playlists !== 'object' || Array.isArray(playlists)) {
    throw new Error('spotifyPlaylists must be an object of years and Spotify playlist URLs.');
  }
  return Object.fromEntries(
    Object.entries(playlists).map(([year, link]) => {
      const url = typeof link === 'string' && URL.canParse(link) ? new URL(link) : null;
      if (
        !/^\d{4}$/.test(year) ||
        Number(year) < 2027 ||
        url?.origin !== 'https://open.spotify.com' ||
        url.username ||
        url.password ||
        !/^\/playlist\/[A-Za-z0-9]{22}\/?$/.test(url.pathname)
      ) {
        throw new Error(
          'spotifyPlaylists requires years from 2027 and public Spotify playlist URLs.',
        );
      }
      return [year, url.origin + url.pathname];
    }),
  );
}

function siteUrl(value, workspace) {
  const url = typeof value === 'string' && URL.canParse(value) ? new URL(value) : null;
  if (!url || url.protocol !== 'https:' || url.href !== `${url.origin}/` || value !== url.origin) {
    throw new Error('siteUrl must be an HTTPS origin without path or trailing slash.');
  }
  // El dominio público también vive en archivos estáticos que no pasan por Angular.
  const expected = {
    'wrangler.jsonc': `"pattern": "${url.host}"`,
    'src/index.html': `${url.origin}/social-card.png`,
    'public/robots.txt': `${url.origin}/sitemap.xml`,
    'public/sitemap.xml': `${url.origin}/`,
  };
  for (const [file, text] of Object.entries(expected)) {
    if (!readFileSync(new URL(file, workspace), 'utf8').includes(text)) {
      throw new Error(`${file} must reference ${url.origin}.`);
    }
  }
  return url.origin;
}

function productionConfig(workspace) {
  let config;
  try {
    config = JSON.parse(readFileSync(new URL('deploy/production.json', workspace), 'utf8'));
  } catch {
    throw new Error('deploy/production.json must be valid JSON.');
  }
  const keys = Object.keys(config ?? {})
    .sort()
    .join(',');
  if (keys !== 'apiBaseUrl,siteUrl,spotifyPlaylists') {
    throw new Error(
      'deploy/production.json requires only siteUrl, apiBaseUrl and spotifyPlaylists.',
    );
  }
  siteUrl(config.siteUrl, workspace);
  return {
    apiBaseUrl: apiBaseUrl(config.apiBaseUrl),
    spotifyPlaylists: spotifyPlaylists(JSON.stringify(config.spotifyPlaylists)),
  };
}

const check = process.argv[2] === '--check';
if (process.argv.length !== (check ? 3 : 2)) {
  throw new Error('Use npm run build for production or npm run build:check for local validation.');
}

const workspace = new URL('../', import.meta.url);
// Valores públicos versionados: el build productivo no depende de variables del entorno.
const config = check
  ? { apiBaseUrl: 'https://365-tracks.invalid/api', spotifyPlaylists: {} }
  : productionConfig(workspace);
const environment = { ...config, fixtures: false };
const configDir = new URL('.tmp/', workspace);
const productionEnvironment = new URL('environment.production.ts', configDir);
mkdirSync(configDir, { recursive: true });
writeFileSync(
  productionEnvironment,
  `export const environment = ${JSON.stringify(environment)};\n`,
  {
    flag: 'wx',
  },
);

try {
  const ng = fileURLToPath(new URL('node_modules/@angular/cli/bin/ng.js', workspace));
  const args = check ? ['--output-path', '.tmp/production-check'] : [];
  const result = spawnSync(
    process.execPath,
    [ng, 'build', '--configuration', 'production', ...args],
    {
      cwd: workspace,
      stdio: 'inherit',
    },
  );
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  unlinkSync(productionEnvironment);
}
