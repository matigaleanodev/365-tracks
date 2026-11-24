# 365 Tracks

[English](README.md)

Frontend público de descubrimiento musical: una canción diaria compartida, una breve explicación, enlaces a Spotify e historial cronológico. El [diseño de Edición diaria](DESIGN.md) define la identidad objetivo.

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

Definí `API_BASE_URL` con la URL pública HTTPS del output `ApiUrl` del stack del backend. Conservá la ruta del stage si existe y agregá `/api` al final. Ejecutá `npm run build` con esa variable definida. El build valida la URL y la pasa a Angular mediante un archivo de entorno temporal. Desarrollo y fixtures conservan sus propios reemplazos de archivo.

El frontend consume el contrato de `365-tracks-api`:

- `GET {apiBaseUrl}/tracks/today?timezone=...` y `GET {apiBaseUrl}/tracks/YYYY-MM-DD?timezone=...` devuelven `{ data: Track }`. HTTP 404 con `TRACK_NOT_FOUND` indica que la selección aún no se publicó.
- `GET {apiBaseUrl}/tracks?timezone=...&limit=30&cursor=...` devuelve `{ data: Track[], pagination: { limit, nextCursor } }`. La primera solicitud omite `cursor`. Para cargar más, enviá el `nextCursor` opaco tal como llegó. `null` marca el fin del historial descendente.
- `Track` requiere `date`, `title`, `artist`, `album`, `releaseYear`, `spotifyTrackId`, `spotifyUrl`, `selectionCriterion` y `createdAt`. `coverUrl` y `description` se pueden omitir.
- Los errores tienen el formato `{ error: { code, message, requestId? } }`. Los fallos inesperados y las respuestas exitosas malformadas permiten reintentar.

El frontend envía la zona horaria IANA del navegador o `UTC` si falla la detección. La API determina qué publicaciones son visibles y devuelve la fecha que se muestra con cada canción. En el inicio, un cambio de fecha local vuelve a consultar `/tracks/today`, también al regresar a una pestaña oculta. Si la API todavía devuelve una fecha anterior o `TRACK_NOT_FOUND`, el inicio puede reintentar durante los primeros dos minutos del día local.

El reloj del visitante programa estas consultas. Si está atrasado, la actualización puede demorarse lo que dure el desfase. Para sincronizarla con precisión, la API tendría que exponer su reloj o el instante de la próxima publicación tanto en respuestas exitosas como en `TRACK_NOT_FOUND`. JavaScript solo puede leer el encabezado HTTP `Date` de otro origen si CORS lo expone explícitamente.

## Archivo en Spotify

Definí `SPOTIFY_PLAYLISTS` al compilar como un objeto JSON cuyas claves sean años desde `2027` y cuyos valores sean las URLs públicas `https://open.spotify.com/playlist/` con los identificadores de las playlists correspondientes. Agregá cada playlist cuando sea pública. Historial muestra los enlaces en otra pestaña y ordena los años de más a menos reciente. Omití la variable o usá `{}` para ocultar la sección. El modo fixtures siempre la oculta.

La playlist se actualiza fuera de Angular. Una canción puede aparecer en el historial de la app antes de que se agregue a Spotify, porque la playlist espera a que la fecha de publicación termine en todas las zonas horarias. La canción del día tiene su propio enlace a Spotify. El acceso a la playlist y su sincronización no requieren un endpoint público nuevo.

## Cloudflare Pages

Usá `npm run build` y publicá `dist/365-tracks/browser`. Configurá Node.js según `.nvmrc`, definí `API_BASE_URL` y, opcionalmente, `SPOTIFY_PLAYLISTS` en el entorno de build. Ambos valores quedan en el código del navegador y solo deben contener URLs públicas. Para Direct Upload, definí las mismas variables en la terminal donde compilás. Para una vista previa local, serví la salida del build con un servidor estático que resuelva las rutas de la aplicación con `index.html`.

Cuando se defina el dominio, agregá el origen público exacto del frontend a `CORS_ALLOWED_ORIGINS` del backend. Usá `https://<dominio-del-frontend>` con puerto solo si corresponde, sin ruta ni barra final. Si se usan un dominio propio y un host `pages.dev`, agregá sus orígenes por separado. El `index.html` raíz de Angular y la ausencia de un `404.html` raíz habilitan el fallback SPA de Pages para las rutas profundas. `public/_headers` define encabezados de respuesta.

Referencia: [Compatibilidad de Angular](https://angular.dev/reference/versions), [Angular en Cloudflare](https://developers.cloudflare.com/pages/framework-guides/deploy-an-angular-site/), [Rutas SPA en Pages](https://developers.cloudflare.com/pages/configuration/serving-pages/#single-page-application-spa-rendering).
