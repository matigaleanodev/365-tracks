// Comprueba la salida publicable antes de servirla con Wrangler o desplegarla.
// Uso: node scripts/verify-dist.mjs [directorio]  (por defecto, la salida de npm run build)
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const workspace = fileURLToPath(new URL('../', import.meta.url));
const root = process.argv[2] ?? join(workspace, 'dist/365-tracks/browser');
const config = JSON.parse(readFileSync(join(workspace, 'deploy/production.json'), 'utf8'));
const failures = [];
const fail = (message) => failures.push(message);

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

if (!existsSync(join(root, 'index.html'))) {
  console.error(`No existe ${root}/index.html. Ejecutá npm run build primero.`);
  process.exit(1);
}

const all = files(root).map((path) => relative(root, path).replaceAll('\\', '/'));
for (const required of [
  '_headers',
  'robots.txt',
  'sitemap.xml',
  'favicon.svg',
  'favicon-32.png',
  'apple-touch-icon.png',
  'social-card.png',
  'site.webmanifest',
]) {
  if (!all.includes(required)) fail(`Falta ${required}.`);
}

// Fixtures, mapas de fuentes y archivos de trabajo no se publican.
for (const path of all) {
  if (/(^|\/)fixtures?(\/|\.)/i.test(path)) fail(`Recurso de fixtures publicado: ${path}`);
  if (path.endsWith('.map')) fail(`Source map publicado: ${path}`);
  if (/(^|\/)(\.|404\.html$)/.test(path)) fail(`Archivo no publicable: ${path}`);
}

const textFiles = all.filter((path) => /\.(html|js|css|txt|xml|json|webmanifest|svg)$/.test(path));
const forbidden = [
  [/Una ventana abierta|fixture-track-|\/fixtures\/cover\.svg/, 'datos de fixtures'],
  [/localhost|365-tracks\.invalid/, 'URL local o de validación'],
  [/AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY|ghp_[A-Za-z0-9]{20,}|github_pat_/, 'credencial'],
  [/client_secret|refresh_token|CLOUDFLARE_API_TOKEN|SPOTIFY_CLIENT/i, 'nombre de secreto'],
];
for (const path of textFiles) {
  const text = readFileSync(join(root, path), 'utf8');
  for (const [pattern, label] of forbidden) {
    if (pattern.test(text)) fail(`${path} contiene ${label}.`);
  }
}

const js = all
  .filter((path) => path.endsWith('.js'))
  .map((path) => readFileSync(join(root, path), 'utf8'))
  .join('\n');
if (!js.includes(config.apiBaseUrl))
  fail('El bundle no usa la apiBaseUrl de deploy/production.json.');
for (const link of Object.values(config.spotifyPlaylists)) {
  if (!js.includes(link)) fail(`El bundle no incluye la playlist ${link}.`);
}

// Los metadatos para compartir deben estar en el HTML servido, sin ejecutar JavaScript.
const html = readFileSync(join(root, 'index.html'), 'utf8');
const site = config.siteUrl;
for (const tag of [
  `<meta property="og:image" content="${site}/social-card.png"`,
  '<meta name="twitter:card" content="summary_large_image"',
  '<meta name="description"',
  '<link rel="apple-touch-icon"',
  '<link rel="manifest"',
]) {
  if (!html.includes(tag)) fail(`index.html no incluye ${tag}`);
}

if (failures.length) {
  console.error(failures.map((message) => `- ${message}`).join('\n'));
  process.exit(1);
}
console.log(`Distribución verificada: ${all.length} archivos en ${relative(workspace, root)}.`);
