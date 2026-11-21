# 365 Tracks

[English](README.md)

Frontend público de descubrimiento musical: una canción diaria compartida, una breve explicación, enlaces a Spotify e historial cronológico. El nombre y la estética son provisionales.

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
npm run build
```

`npm run format` aplica formato; `npm run test:watch` activa el modo observación. GitHub Actions valida lint, formato, tests unitarios y build de producción, sin desplegar.

## Arquitectura

Angular 22 standalone, TypeScript strict, SCSS, rutas lazy con Angular Router y HttpClient. Signals readonly exponen el estado de las vistas; computed deriva valores. RxJS combina cambios de ruta y reintentos, cancela solicitudes HTTP obsoletas y convierte respuestas a signals readonly. Componentes con OnPush e inject(). Sin librería de componentes, SSR, reproductor ni SDK de servicios externos.

| Ruta            | Vista                                                   |
| --------------- | ------------------------------------------------------- |
| `/`             | Canción del día, carga, error y ausencia de publicación |
| `/history`      | Historial descendente con carga incremental             |
| `/tracks/:date` | Canción de una fecha o estado sin publicación           |

`src/app/core` contiene el contrato tipado y la validación de respuestas; `pages`, las vistas enrutadas; `shared`, la portada y la presentación completa de una canción. `src/app/dev` y `dev-assets` contienen fixtures locales. El tema sigue la preferencia clara/oscura del sistema. Las fechas sin hora se presentan en UTC para evitar mostrar el día anterior en zonas negativas. El backend determina el día de publicación compartido.

## Configuración y contrato de la API

Configurar `apiBaseUrl` en `src/environments/environment.ts` antes del build de producción. Usá la URL del stage que devuelve el output `ApiUrl` del stack del backend y agregá el prefijo `/api` (por ejemplo, `https://<api-id>.execute-api.<region>.amazonaws.com/api` para el stage predeterminado). Desarrollo reemplaza ese archivo por `environment.development.ts`; fixtures usa `environment.fixtures.ts` y reemplaza los providers de fixtures, vacíos por defecto. Otros entornos pueden usar file replacements de Angular. Estos valores son configuración pública de compilación, nunca secretos; las variables del hosting no se inyectan automáticamente en el navegador.

El frontend consume el contrato de `365-tracks-api`:

- `GET {apiBaseUrl}/tracks/today?timezone=...` y `GET {apiBaseUrl}/tracks/YYYY-MM-DD?timezone=...` devuelven `{ data: Track }`. HTTP 404 con `TRACK_NOT_FOUND` indica que la selección aún no se publicó.
- `GET {apiBaseUrl}/tracks?timezone=...&limit=30&cursor=...` devuelve `{ data: Track[], pagination: { limit, nextCursor } }`. La primera solicitud omite `cursor`. Para cargar más, enviá el `nextCursor` opaco tal como llegó. `null` marca el fin del historial descendente.
- `Track` requiere `date`, `title`, `artist`, `album`, `releaseYear`, `spotifyTrackId`, `spotifyUrl`, `selectionCriterion` y `createdAt`. `coverUrl` y `description` se pueden omitir.
- Los errores tienen el formato `{ error: { code, message, requestId? } }`. Los fallos inesperados y las respuestas exitosas malformadas permiten reintentar.

El frontend envía la zona horaria IANA del navegador o `UTC` si falla la detección. En el inicio, un cambio de fecha local vuelve a consultar `/tracks/today`, también al regresar a una pestaña oculta. La API determina qué publicaciones son visibles y devuelve la fecha que se muestra con cada canción.

## Archivo en Spotify

En el archivo de entorno correspondiente, agregá la URL pública de Spotify a `spotifyPlaylists` con el año como clave, desde `2027`. Configurala cuando la playlist ya sea pública. Para años siguientes, agregá entradas al mismo mapa. Historial muestra los enlaces HTTPS válidos en otra pestaña y ordena los años de más a menos reciente. Dejá el mapa vacío para ocultar la sección. El modo fixtures siempre la oculta.

La playlist se actualiza fuera de Angular. Una canción puede aparecer en el historial de la app antes de que se agregue a Spotify, porque la playlist espera a que la fecha de publicación termine en todas las zonas horarias. La canción del día tiene su propio enlace a Spotify. El acceso a la playlist y su sincronización no requieren un endpoint público nuevo.

## Cloudflare Pages

Compilar como SPA estática con `npm run build`. La carpeta de salida es `dist/365-tracks/browser`. Configurar Node.js según `.nvmrc`, apuntar el entorno de API al backend real y habilitar el origen del frontend en CORS. El `index.html` raíz de Angular y la ausencia de un `404.html` raíz permiten que el fallback SPA nativo de Cloudflare Pages sirva las rutas profundas. `public/_headers` define encabezados básicos de respuesta.

No se configura cuenta de Cloudflare, proyecto Pages, despliegue de producción ni despliegue automático. Cuando se autorice el hosting, se puede subir el build estático mediante Direct Upload para evitar despliegues automáticos por Git.

Referencia: [Compatibilidad de Angular](https://angular.dev/reference/versions), [Angular en Cloudflare](https://developers.cloudflare.com/pages/framework-guides/deploy-an-angular-site/), [Rutas SPA en Pages](https://developers.cloudflare.com/pages/configuration/serving-pages/#single-page-application-spa-rendering).
