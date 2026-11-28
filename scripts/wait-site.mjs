// Espera acotada a que un dominio recién creado sea alcanzable, antes de verificar el sitio.
// Uso: node scripts/wait-site.mjs <dns|https> <origen> [segundos]  (por defecto 300)
//
// dns:   consulta los servidores autoritativos de la zona, que no guardan caché, hasta que el
//        nombre tiene registros A. No usa el resolvedor del sistema: un NXDOMAIN consultado antes
//        de que Cloudflare cree el registro queda en caché unos 30 min (mínimo del SOA).
// https: espera una respuesta HTTP con un certificado válido. Solo reintenta lo propio de un
//        dominio en preparación (DNS, conexión, TLS y 5xx); cualquier otra respuesta termina la
//        espera y el contrato lo juzga verify-site.mjs.
import { promises as dns } from 'node:dns';
import https from 'node:https';

const [mode, origin, seconds = '300'] = process.argv.slice(2);
if (!['dns', 'https'].includes(mode) || !origin || !(Number(seconds) > 0)) {
  console.error('Uso: node scripts/wait-site.mjs <dns|https> <origen> [segundos]');
  process.exit(2);
}
const host = new URL(origin).hostname;
const deadline = Date.now() + Number(seconds) * 1000;
const pause = 10_000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Errores esperables mientras se propaga un registro nuevo o se emite su certificado.
const transientDns = new Set(['ENOTFOUND', 'ENODATA', 'ETIMEOUT', 'ESERVFAIL', 'ECONNREFUSED']);
const transientNet = new Set([
  'ENOTFOUND',
  'EAI_AGAIN',
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EPROTO',
  'ERR_SSL_SSLV3_ALERT_HANDSHAKE_FAILURE',
  'ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'ERR_TLS_CERT_ALTNAME_INVALID',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'CERT_HAS_EXPIRED',
]);

// Servidores autoritativos de la zona más cercana con registros NS (el apex ya existe).
// ENOTFOUND/ENODATA solo indican que esa etiqueta no es una zona; los demás errores de DNS se
// propagan con su código para que el ciclo reintente los transitorios y corte con el resto.
const notZone = new Set(['ENOTFOUND', 'ENODATA']);
async function authoritative() {
  const labels = host.split('.');
  for (let i = 1; i < labels.length - 1; i++) {
    const zone = labels.slice(i).join('.');
    const names = await dns.resolveNs(zone).catch((error) => {
      if (notZone.has(error.code)) return [];
      throw error;
    });
    if (!names.length) continue;
    // Alcanza con un NS que resuelva; si ninguno lo hace, se propaga el primer error.
    const results = await Promise.allSettled(names.map((name) => dns.resolve4(name)));
    const addresses = results.flatMap((result) => result.value ?? []);
    if (addresses.length) return { zone, addresses };
    const failed = results.find((result) => result.status === 'rejected');
    if (failed) throw failed.reason;
  }
  throw Object.assign(new Error(`no se encontraron servidores autoritativos para ${host}`), {
    code: 'ENOAUTH',
  });
}

function request() {
  return new Promise((resolve, reject) => {
    https
      .request(origin, { method: 'HEAD' }, (response) => {
        response.resume();
        resolve(response.statusCode);
      })
      .on('error', reject)
      .setTimeout(10_000, function () {
        this.destroy(Object.assign(new Error('sin respuesta en 10 s'), { code: 'ETIMEDOUT' }));
      })
      .end();
  });
}

async function attempt() {
  if (mode === 'dns') {
    try {
      if (!resolver) {
        const { zone, addresses } = await authoritative();
        resolver = new dns.Resolver({ timeout: 5000, tries: 1 });
        resolver.setServers(addresses);
        console.log(`Consultando ${host} en los servidores autoritativos de ${zone}.`);
      }
      const records = await resolver.resolve4(host);
      return { done: true, detail: records.join(', ') };
    } catch (error) {
      if (!transientDns.has(error.code)) throw error;
      return { done: false, detail: error.code };
    }
  }
  try {
    const status = await request();
    if (status >= 500) return { done: false, detail: `estado ${status}` };
    return { done: true, detail: `estado ${status}` };
  } catch (error) {
    if (!transientNet.has(error.code)) throw error;
    return { done: false, detail: `${error.code}: ${error.message}` };
  }
}

let resolver;

for (let tries = 1; ; tries++) {
  const { done, detail } = await attempt();
  if (done) {
    console.log(`${mode.toUpperCase()} listo para ${host} (${detail}) en el intento ${tries}.`);
    process.exit(0);
  }
  if (Date.now() + pause > deadline) {
    console.error(`${mode.toUpperCase()} no quedó listo para ${host} en ${seconds} s: ${detail}.`);
    process.exit(1);
  }
  console.log(`Intento ${tries}: ${detail}; se reintenta en ${pause / 1000} s.`);
  await sleep(pause);
}
