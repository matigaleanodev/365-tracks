// Comprueba el contrato HTTP del sitio servido por Workers: rutas profundas, 404 de archivos,
// tipos MIME, caché y metadatos sin JavaScript. Sirve para la preview local y para el sitio
// publicado. Uso: node scripts/verify-site.mjs [origen]  (por defecto http://127.0.0.1:8787)
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const origin = (process.argv[2] ?? 'http://127.0.0.1:8787').replace(/\/$/, '');
const workspace = fileURLToPath(new URL('../', import.meta.url));
const { siteUrl, apiBaseUrl } = JSON.parse(
  readFileSync(`${workspace}deploy/production.json`, 'utf8'),
);
const browser = `${workspace}dist/365-tracks/browser`;
const built = readdirSync(browser);
const main = built.find((name) => /^main-[\w-]+\.js$/.test(name));
const styles = built.find((name) => /^styles-[\w-]+\.css$/.test(name));
const failures = [];
const navigate = { 'Sec-Fetch-Mode': 'navigate', Accept: 'text/html' };
const immutable = 'public, max-age=31536000, immutable';
const revalidate = 'public, max-age=0, must-revalidate';

async function check(path, expected, headers = {}) {
  let response;
  try {
    response = await fetch(origin + path, { headers, redirect: 'manual' });
  } catch (error) {
    failures.push(`${path}: ${error.message}`);
    return '';
  }
  const body = await response.text();
  const problems = [];
  if (response.status !== expected.status) problems.push(`estado ${response.status}`);
  const type = response.headers.get('content-type') ?? '';
  if (expected.type && !type.startsWith(expected.type)) problems.push(`tipo ${type}`);
  const cache = response.headers.get('cache-control') ?? '';
  if (expected.cache && cache !== expected.cache) problems.push(`caché ${cache}`);
  if (response.headers.get('x-content-type-options') !== 'nosniff') problems.push('sin nosniff');
  if (problems.length) failures.push(`${path}: ${problems.join(', ')}`);
  return body;
}

const page = { status: 200, type: 'text/html', cache: revalidate };
const routes = ['/', '/history', '/tracks/2027-01-05', '/history/', '/ruta-inexistente'];
for (const path of routes) {
  // Navegador (sin invocar el Worker) y lector de enlaces sin cabeceras Sec-Fetch.
  for (const headers of [navigate, { 'User-Agent': 'facebookexternalhit/1.1' }]) {
    const html = await check(path, page, headers);
    for (const tag of [
      `<meta property="og:image" content="${siteUrl}/social-card.png"`,
      '<meta name="twitter:card" content="summary_large_image"',
    ]) {
      if (html && !html.includes(tag)) failures.push(`${path}: falta ${tag}`);
    }
  }
}

for (const [path, expected] of [
  [`/${main}`, { status: 200, type: 'text/javascript', cache: immutable }],
  [`/${styles}`, { status: 200, type: 'text/css', cache: immutable }],
  ['/fonts/newsreader-latin.woff2', { status: 200, type: 'font/woff2' }],
  ['/favicon.svg', { status: 200, type: 'image/svg+xml' }],
  ['/favicon-32.png', { status: 200, type: 'image/png' }],
  ['/apple-touch-icon.png', { status: 200, type: 'image/png' }],
  ['/social-card.png', { status: 200, type: 'image/png' }],
  ['/site.webmanifest', { status: 200, type: 'application/manifest+json', cache: revalidate }],
  ['/robots.txt', { status: 200, type: 'text/plain', cache: revalidate }],
  ['/sitemap.xml', { status: 200, type: 'application/xml', cache: revalidate }],
  // Un chunk de otra versión no puede recibir index.html con caché inmutable.
  ['/chunk-INEXISTENTE.js', { status: 404, type: 'text/plain', cache: 'no-store' }],
  ['/fonts/inexistente.woff2', { status: 404, type: 'text/plain', cache: 'no-store' }],
]) {
  await check(path, expected);
}

// Contra el sitio publicado, la API tiene que aceptar su origen por CORS.
if (origin === siteUrl) {
  try {
    const response = await fetch(`${apiBaseUrl}/tracks?limit=1`, { headers: { Origin: siteUrl } });
    const allowed = response.headers.get('access-control-allow-origin');
    if (!response.ok || allowed !== siteUrl) {
      failures.push(`API: estado ${response.status}, Access-Control-Allow-Origin ${allowed}`);
    }
  } catch (error) {
    failures.push(`API: ${error.message}`);
  }
}

if (failures.length) {
  console.error(`Fallas en ${origin}:\n${failures.map((line) => `- ${line}`).join('\n')}`);
  process.exit(1);
}
console.log(`Sitio verificado en ${origin}.`);
