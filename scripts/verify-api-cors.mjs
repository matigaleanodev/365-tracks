// Comprueba que la API de producción acepta el origen del sitio por CORS. El despliegue lo corre
// antes de publicar: si la API todavía no permite el origen, el sitio no podría cargar canciones.
// Uso: node scripts/verify-api-cors.mjs
import { readFileSync } from 'node:fs';

const { siteUrl, apiBaseUrl } = JSON.parse(
  readFileSync(new URL('../deploy/production.json', import.meta.url), 'utf8'),
);

try {
  const response = await fetch(`${apiBaseUrl}/tracks?limit=1&timezone=UTC`, {
    headers: { Origin: siteUrl },
    signal: AbortSignal.timeout(20_000),
  });
  const allowed = response.headers.get('access-control-allow-origin');
  if (!response.ok || allowed !== siteUrl) {
    console.error(
      `La API no acepta ${siteUrl}: estado ${response.status}, Access-Control-Allow-Origin ${allowed}.`,
    );
    process.exit(1);
  }
  console.log(`La API acepta ${siteUrl} por CORS.`);
} catch (error) {
  console.error(`No se pudo consultar la API: ${error.message}`);
  process.exit(1);
}
