# Despliegue en Cloudflare Workers

[English](DEPLOYMENT.md)

Daywave se publica como un Worker con assets estáticos en `https://daywave.matiasgaleano.dev`. La configuración vive en [`wrangler.jsonc`](wrangler.jsonc) y los valores públicos del build en [`deploy/production.json`](deploy/production.json).

## Cómo se sirve

- `npm run build` genera `dist/365-tracks/browser`, que Wrangler sube como assets. Cloudflare los sirve sin ejecutar código: las solicitudes a assets estáticos no tienen costo ni consumen las solicitudes del plan gratuito.
- `not_found_handling: "single-page-application"` responde con `index.html` y estado 200 a las navegaciones de navegador hacia rutas de Angular (`/history`, `/tracks/AAAA-MM-DD`), también al recargar.
- [`worker/index.js`](worker/index.js) solo recibe lo que los assets no resuelven fuera de una navegación: a rutas sin extensión pedidas por lectores de enlaces o buscadores les devuelve el mismo `index.html`, y a archivos inexistentes, por ejemplo un chunk de una versión anterior, un 404 sin caché. Así un chunk faltante nunca queda guardado como HTML con caché inmutable. No tiene bindings ni estado.
- Un único origen público: `workers_dev` y `preview_urls` están deshabilitados.
- [`public/_headers`](public/_headers) define los encabezados de seguridad y la caché: archivos con hash de Angular (`*.js`, `*.css`) inmutables por un año, fuentes e imágenes por una semana, y `index.html`, `robots.txt`, `sitemap.xml` y el manifiesto con el valor predeterminado de Workers (`public, max-age=0, must-revalidate` con ETag), para que cada despliegue se vea de inmediato. Workers asigna los tipos MIME por extensión.

## Valores públicos

[`deploy/production.json`](deploy/production.json) es la única fuente del build productivo y queda en el bundle del navegador. No contiene secretos.

| Clave              | Uso                                                                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `siteUrl`          | Origen público. El build comprueba que coincida con `wrangler.jsonc`, la imagen de Open Graph de `src/index.html`, `robots.txt` y `sitemap.xml`. |
| `apiBaseUrl`       | URL HTTPS del output `ApiUrl` de `365-tracks-api`, con `/api` al final.                                                                          |
| `spotifyPlaylists` | Años desde 2027 y URLs públicas `https://open.spotify.com/playlist/<id>`. Un año nuevo es un cambio revisado a este archivo.                     |

`npm run build:check` usa una URL de validación aislada y no lee este archivo.

## Secretos

Solo el workflow de despliegue usa credenciales, como secretos del entorno `production` de GitHub, limitado a `main` y sin revisores: el merge autorizado del release es la aprobación.

| Secreto                 | Valor                                                                                                                                                                                                                                                     |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID de la cuenta de Cloudflare que contiene la zona `matiasgaleano.dev`.                                                                                                                                                                           |
| `CLOUDFLARE_API_TOKEN`  | Token propio (Custom token) con **Account › Workers Scripts › Edit** sobre esa cuenta y **Zone › Workers Routes › Edit** solo sobre la zona `matiasgaleano.dev`. Sin otros permisos ni zonas. Conviene fijarle vencimiento y rotarlo con el mismo script. |

## Configuración inicial

1. Verificar que la zona `matiasgaleano.dev` esté activa en Cloudflare y que `daywave` no tenga un registro DNS CNAME existente: el dominio propio de Workers crea el registro y el certificado.
2. Crear el token del cuadro anterior en **My Profile › API Tokens › Create Token › Custom token**.
3. Desde WSL, en la raíz del repositorio, ejecutar `bash scripts/setup-github-secrets.sh`. Crea o ajusta el entorno `production` (solo `main`, sin revisores) y pide ambos valores sin eco.
4. Publicar antes el backend con el origen del sitio en CORS (ver [Dependencias del backend](#dependencias-del-backend)).
5. Integrar un `release/x.x.x` en `main`, con `version` de `package.json` igual a `x.x.x` (CI lo exige en el pull request). El primer despliegue crea el Worker `daywave` y su dominio.

## Despliegue automático

[`deploy.yml`](.github/workflows/deploy.yml) corre al integrar en `main` y, como alternativa, a mano desde `main`, sin inputs:

1. Instala, valida (lint, formato, tests), compila con `deploy/production.json` y verifica la distribución (`npm run verify:dist`: sin fixtures, source maps ni secretos, con los metadatos y la configuración esperados).
2. Publica con `wrangler deploy`, usando el commit como mensaje de la versión.
3. Verifica el sitio publicado con `scripts/verify-site.mjs` (rutas profundas, 404 de archivos, tipos MIME, caché, metadatos sin JavaScript y CORS de la API para el dominio), con reintentos durante unos 5 minutos para la creación inicial del certificado. Si la verificación falla con el sitio ya publicado, corregir la causa y volver a ejecutar el workflow: el despliegue es idempotente y `release` corre cuando la verificación pasa.
4. El job `release` crea el tag y la release de GitHub `v<versión de package.json>` con notas generadas, si todavía no existen. La versión `0.0.0` no se publica.

[`ci.yml`](.github/workflows/ci.yml) valida cada pull request hacia `dev` y `main` sin credenciales, y en un `release/x.x.x` que `package.json` tenga esa versión: lint, formato, tests, build productivo, verificación de la distribución, `wrangler deploy --dry-run` y la preview local con `verify-site`. [`branch-policy.yml`](.github/workflows/branch-policy.yml) controla el flujo de ramas.

## Validación local y preview

```sh
npm run preview          # build productivo, verify:dist y wrangler dev en http://127.0.0.1:8787
npm run verify:site      # en otra terminal, contra la preview
node scripts/verify-site.mjs https://daywave.matiasgaleano.dev   # contra el sitio publicado
```

La preview usa la API real. El backend debe permitir el origen del navegador por CORS: la preview local (`http://127.0.0.1:8787`) no figura en la lista productiva, así que en local la API solo responde a recorridos que reenvíen las solicitudes.

## Rollback

- **Versión anterior del Worker:** `npx wrangler deployments list` y `npx wrangler rollback [version-id]` con `wrangler login` o un token con los permisos anteriores, o **Workers & Pages › daywave › Deployments › Rollback** en el panel. Es inmediato y no requiere build.
- **Corrección definitiva:** un nuevo `release/x.x.x` hacia `main` con el arreglo o la reversión. Un rollback manual queda reemplazado por el siguiente despliegue automático.
- Los assets de cada versión se publican completos, así que volver a una versión anterior no mezcla archivos.

## Subdominio

`routes` declara `daywave.matiasgaleano.dev` como dominio propio (`custom_domain: true`). Cloudflare administra el registro DNS y el certificado. Para retirarlo, quitar la entrada y desplegar, o eliminarlo en **Workers & Pages › daywave › Settings › Domains & Routes**. No se usa ningún dominio adicional.

## Dependencias del backend

- `corsAllowedOrigins` de `365-tracks-api` (`deploy/production.json`) debe incluir `https://daywave.matiasgaleano.dev`, sin barra final.
- Si cambia la URL de la API, actualizar `apiBaseUrl` y publicar un release del frontend.
