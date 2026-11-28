# Daywave

[![CI](https://img.shields.io/github/actions/workflow/status/matigaleanodev/365-tracks/ci.yml?style=flat-square&label=CI)](https://github.com/matigaleanodev/365-tracks/actions/workflows/ci.yml)
![Versión](https://img.shields.io/badge/versi%C3%B3n-0.0.0-blue?style=flat-square)
![Angular](https://img.shields.io/badge/Angular-22-DD0031?style=flat-square&logo=angular&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?style=flat-square&logo=cloudflare&logoColor=white)

[English](README.md)

Frontend público de descubrimiento musical: una canción diaria compartida, una breve explicación, enlaces a Spotify e historial cronológico. El [diseño de Edición diaria](DESIGN.md) documenta la marca y sus recursos.

## Desarrollo

Usar el Node.js indicado en `.nvmrc` y npm 11.

```sh
nvm use
npm ci
npm start
```

Abrir `http://localhost:4200`. El entorno de desarrollo consume `http://localhost:3000/api`. Serví `365-tracks-api` por HTTP en el puerto 3000 y habilitá el origen `http://localhost:4200` en CORS. Para usar otro puerto o una API desplegada, ajustá `apiBaseUrl` en `src/environments/environment.development.ts`. El comando `npm run invoke` del backend ejecuta el handler Lambda directamente y no levanta un servidor HTTP.

```sh
npm run start:fixtures
```

Este modo local separado intercepta los tres endpoints de canciones. Sus canciones, fechas y portadas originales de ejemplo son ficticias y llevan un aviso de demostración. La demo oculta los enlaces ficticios a Spotify e incluye canciones con y sin portada y descripción. Abrí `/?fixture=empty` o `/history?fixture=empty` para probar los estados sin publicación e historial vacío. Usá `?fixture=error` en la ruta para simular HTTP 500. Los fixtures y sus recursos quedan fuera del build de producción.

```sh
npm run lint
npm run format:check
npm test
npm run build:check
```

`npm run format` aplica formato y `npm run test:watch` activa el modo observación. GitHub Actions ejecuta las mismas comprobaciones. `build:check` compila la configuración de producción con una URL de validación aislada y deja la salida en `.tmp/production-check/browser`.

## Arquitectura

Angular 22 standalone, TypeScript strict, SCSS, rutas lazy con Angular Router y HttpClient. Signals readonly exponen el estado de las vistas; computed deriva valores. RxJS combina cambios de ruta y reintentos, cancela solicitudes HTTP obsoletas y convierte respuestas a signals readonly. Componentes con OnPush e inject(). Sin librería de componentes, SSR, reproductor ni SDK de servicios externos.

| Ruta            | Vista                                                   |
| --------------- | ------------------------------------------------------- |
| `/`             | Canción del día, carga, error y ausencia de publicación |
| `/history`      | Historial descendente con carga incremental             |
| `/tracks/:date` | Canción de una fecha o estado sin publicación           |

`src/app/core` contiene el contrato tipado y la validación de respuestas; `pages`, las vistas enrutadas; `shared`, la portada y la presentación completa de una canción. `src/app/dev` y `dev-assets` contienen fixtures locales. El selector de tema sigue al sistema por defecto y guarda una elección explícita de Claro u Oscuro. Las fechas sin hora se presentan en UTC para evitar mostrar el día anterior en zonas negativas. El backend determina el día de publicación compartido.

## Configuración y contrato de la API

`npm run build` lee los valores públicos de producción de [`deploy/production.json`](deploy/production.json): `apiBaseUrl` es la URL pública HTTPS del output `ApiUrl` del stack del backend, con la ruta del stage si existe y `/api` al final. El build valida el archivo y lo pasa a Angular mediante un archivo de entorno temporal. Desarrollo y fixtures conservan sus propios reemplazos de archivo.

El frontend consume el contrato de `365-tracks-api`:

- `GET {apiBaseUrl}/tracks/today?timezone=...` y `GET {apiBaseUrl}/tracks/YYYY-MM-DD?timezone=...` devuelven `{ data: Track }`. HTTP 404 con `TRACK_NOT_FOUND` indica que la selección aún no se publicó.
- `GET {apiBaseUrl}/tracks?timezone=...&limit=30&cursor=...` devuelve `{ data: Track[], pagination: { limit, nextCursor } }`. La primera solicitud omite `cursor`. Para cargar más, enviá el `nextCursor` opaco tal como llegó. `null` marca el fin del historial descendente.
- `Track` requiere `date`, `title`, `artist`, `album`, `releaseYear`, `spotifyTrackId`, `spotifyUrl`, `selectionCriterion` y `createdAt`. `coverUrl` y `description` se pueden omitir.
- Los errores tienen el formato `{ error: { code, message, requestId? } }`. Los fallos inesperados y las respuestas exitosas malformadas permiten reintentar.

El frontend envía la zona horaria IANA del navegador o `UTC` si falla la detección. La API determina qué publicaciones son visibles y devuelve la fecha que se muestra con cada canción. En el inicio, un cambio de fecha local vuelve a consultar `/tracks/today`, también al regresar a una pestaña oculta. Si la API todavía devuelve una fecha anterior o `TRACK_NOT_FOUND`, el inicio puede reintentar durante los primeros dos minutos del día local.

El reloj del visitante programa estas consultas. Si está atrasado, la actualización puede demorarse lo que dure el desfase. Para sincronizarla con precisión, la API tendría que exponer su reloj o el instante de la próxima publicación tanto en respuestas exitosas como en `TRACK_NOT_FOUND`. JavaScript solo puede leer el encabezado HTTP `Date` de otro origen si CORS lo expone explícitamente.

## Archivo en Spotify

`spotifyPlaylists` de [`deploy/production.json`](deploy/production.json) asocia años desde `2027` con URLs públicas `https://open.spotify.com/playlist/`. Agregá cada playlist cuando sea pública. Historial muestra los enlaces en otra pestaña, del año más reciente al más antiguo, y oculta la sección si el objeto está vacío. El modo fixtures siempre la oculta.

La playlist se actualiza fuera de Angular. Una canción puede aparecer en el historial de la app antes de que se agregue a Spotify, porque la playlist espera a que la fecha de publicación termine en todas las zonas horarias. La canción del día tiene su propio enlace a Spotify. El acceso a la playlist y su sincronización no requieren un endpoint público nuevo.

## Publicación

El sitio se sirve con Cloudflare Workers y assets estáticos en `https://daywave.matiasgaleano.dev`. `npm run preview` compila para producción, verifica la salida y la sirve en local con Wrangler. Integrar un release en `main` despliega automáticamente y publica su tag y release. La [guía de despliegue](DEPLOYMENT.es.md) cubre la configuración de Workers, los valores públicos, los secretos, la configuración inicial, el rollback y el dominio propio.

Los metadatos para compartir (título, descripción, Open Graph y la tarjeta social) forman parte de `src/index.html`, así que las vistas previas de enlaces funcionan sin JavaScript. Como todas las rutas reciben el mismo HTML, la URL canónica se declara por ruta al navegar y la página 404 se marca `noindex`. `public/robots.txt` y `public/sitemap.xml` listan las rutas públicas. Los PNG de marca se generan desde `public/daywave-mark.svg` con `bash scripts/brand-assets.sh`.
