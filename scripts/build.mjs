import { spawnSync } from 'node:child_process';
import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
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
    throw new Error('API_BASE_URL must be a public HTTPS URL ending in /api.');
  }
  return url.origin + url.pathname.replace(/\/$/, '');
}

function spotifyPlaylists(value = '{}') {
  let playlists;
  try {
    playlists = JSON.parse(value);
  } catch {
    throw new Error('SPOTIFY_PLAYLISTS must be a JSON object of years and Spotify playlist URLs.');
  }
  if (!playlists || typeof playlists !== 'object' || Array.isArray(playlists)) {
    throw new Error('SPOTIFY_PLAYLISTS must be a JSON object of years and Spotify playlist URLs.');
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
          'SPOTIFY_PLAYLISTS requires years from 2027 and public Spotify playlist URLs.',
        );
      }
      return [year, url.origin + url.pathname];
    }),
  );
}

const check = process.argv[2] === '--check';
if (process.argv.length !== (check ? 3 : 2)) {
  throw new Error('Use npm run build for production or npm run build:check for local validation.');
}

const environment = {
  apiBaseUrl: check ? 'https://365-tracks.invalid/api' : apiBaseUrl(process.env.API_BASE_URL),
  fixtures: false,
  spotifyPlaylists: check ? {} : spotifyPlaylists(process.env.SPOTIFY_PLAYLISTS),
};
const workspace = new URL('../', import.meta.url);
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
