// Comprueba el contrato HTTP del sitio servido por Workers: rutas profundas, 404 de archivos,
// tipos MIME, caché y metadatos sin JavaScript. Sirve para la preview local y para el sitio
// publicado. Uso: node scripts/verify-site.mjs [origen]  (por defecto http://127.0.0.1:8787)
import { readdirSync, readFileSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
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

// node:http en lugar de fetch: fetch reemplaza Sec-Fetch-Mode por `cors`, y acá importa enviar
// exactamente las cabeceras de cada variante (navegación o lector sin Sec-Fetch).
function get(url, headers, method = 'GET') {
  const client = url.startsWith('https:') ? https : http;
  return new Promise((resolve, reject) => {
    client
      .request(url, { method, headers }, (response) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () =>
          resolve({
            status: response.statusCode,
            headers: response.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          }),
        );
        response.on('error', reject);
      })
      .on('error', reject)
      .setTimeout(15000, function () {
        this.destroy(new Error('sin respuesta en 15 s'));
      })
      .end();
  });
}

async function check(path, expected, headers = {}, label = '', method = 'GET') {
  const name = label ? `${path} (${label})` : path;
  let response;
  try {
    response = await get(origin + path, headers, method);
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
    return null;
  }
  const problems = [];
  if (response.status !== expected.status) problems.push(`estado ${response.status}`);
  const type = response.headers['content-type'] ?? '';
  if (expected.type && !type.startsWith(expected.type)) problems.push(`tipo ${type}`);
  const cache = response.headers['cache-control'] ?? '';
  if (expected.cache && cache !== expected.cache) problems.push(`caché ${cache}`);
  if (response.headers['x-content-type-options'] !== 'nosniff') problems.push('sin nosniff');
  if (problems.length) failures.push(`${name}: ${problems.join(', ')}`);
  return response;
}

const reader = { 'User-Agent': 'facebookexternalhit/1.1' };
const variants = [
  [navigate, 'navegación'],
  [reader, 'lector'],
];

const page = { status: 200, type: 'text/html', cache: revalidate };
const routes = ['/', '/history', '/tracks/2027-01-05', '/history/', '/ruta-inexistente'];
for (const path of routes) {
  // Navegador y lector de enlaces sin cabeceras Sec-Fetch: los dos reciben index.html completo.
  for (const [headers, label] of variants) {
    const response = await check(path, page, headers, label);
    if (!response || response.status !== 200) continue;
    if (!response.body.trim()) {
      failures.push(`${path} (${label}): cuerpo vacío`);
      continue;
    }
    for (const tag of [
      `<meta property="og:image" content="${siteUrl}/social-card.png"`,
      '<meta name="twitter:card" content="summary_large_image"',
    ]) {
      if (!response.body.includes(tag)) failures.push(`${path} (${label}): falta ${tag}`);
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
]) {
  await check(path, expected);
}

// El Worker también atiende HEAD en las rutas de Angular.
await check('/history', page, reader, 'HEAD', 'HEAD');

// Un archivo inexistente (como un chunk de otra versión) no puede recibir index.html con caché
// inmutable, tampoco al abrirlo desde la barra de direcciones.
const missing = { status: 404, type: 'text/plain', cache: 'no-store' };
for (const path of ['/chunk-INEXISTENTE.js', '/fonts/inexistente.woff2']) {
  for (const [headers, label] of variants) await check(path, missing, headers, label);
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
