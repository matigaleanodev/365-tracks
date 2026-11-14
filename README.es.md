# 365 Tracks

[English](README.md)

Frontend público de descubrimiento musical: una canción diaria compartida, una breve explicación, enlaces a Spotify e historial cronológico. Las selecciones comienzan el 1 de enero de 2027. El nombre y la estética son provisionales.

## Desarrollo

Usar el Node.js indicado en `.nvmrc` y npm 11.

```sh
nvm use
npm ci
npm start
```

Abrir `http://localhost:4200`. El entorno de desarrollo consume `http://localhost:3000/api` y requiere el backend independiente `365-tracks-api`, con CORS habilitado para el origen del frontend.

```sh
npm run start:fixtures
```

Este modo local separado intercepta los tres endpoints de canciones. Sus canciones, fechas y portadas originales de ejemplo son ficticias y llevan un aviso de demostración. No tienen enlaces a Spotify. Los fixtures y sus recursos quedan fuera del build de producción.

```sh
npm run lint
npm run format:check
npm test
npm run build
```

`npm run format` aplica formato; `npm run test:watch` activa el modo observación. GitHub Actions valida lint, formato, tests unitarios y build de producción, sin desplegar.

## Arquitectura

Angular 22 standalone, TypeScript strict, SCSS, rutas lazy con Angular Router y HttpClient. Signals readonly exponen el estado de las vistas; computed deriva valores. RxJS combina cambios de ruta y reintentos, cancela solicitudes HTTP obsoletas y convierte respuestas a signals readonly. Componentes con OnPush e inject(). Sin librería de componentes, SSR, reproductor ni SDK de servicios externos.

| Ruta              | Vista                                                   |
| ----------------- | ------------------------------------------------------- |
| `/`               | Canción del día, carga, error y ausencia de publicación |
| `/history?page=1` | Historial descendente, 12 canciones por página          |
| `/tracks/:date`   | Canción de una fecha o estado sin publicación           |

`src/app/core` contiene el contrato tipado y la validación de respuestas; `pages`, las vistas enrutadas; `shared`, la portada y la presentación completa de una canción. `src/app/dev` y `dev-assets` contienen fixtures locales. El tema sigue la preferencia clara/oscura del sistema. Las fechas sin hora se presentan en UTC para evitar mostrar el día anterior en zonas negativas. El backend determina el día de publicación compartido.

## Configuración y contrato de la API

Configurar `apiBaseUrl` en `src/environments/environment.ts` antes del build de producción: `https://api.example.com/api` es un placeholder. Desarrollo reemplaza ese archivo por `environment.development.ts`; fixtures usa `environment.fixtures.ts` y reemplaza los providers de fixtures, vacíos por defecto. Otros entornos pueden usar file replacements de Angular. Estos valores son configuración pública de compilación, nunca secretos; las variables del hosting no se inyectan automáticamente en el navegador.

El siguiente contrato de integración es provisional y debe acordarse con `365-tracks-api`:

- `GET {apiBaseUrl}/tracks/today` y `GET {apiBaseUrl}/tracks/YYYY-MM-DD` devuelven un `Track`, `null` o HTTP 404 para un día sin publicación. Los demás fallos permiten reintentar.
- `GET {apiBaseUrl}/tracks?page=1&pageSize=12` devuelve `{ items: Track[], page: number, pageSize: number, total: number }`. Las páginas comienzan en 1; `total` cuenta las entradas del historial. El backend devuelve publicaciones anteriores en orden descendente y excluye la canción de hoy.
- `Track` contiene `date`, `title`, `artist`, `album`, `coverUrl`, `spotifyUrl` y `description`. `date` es una fecha real `YYYY-MM-DD`; los textos no están vacíos; `coverUrl` es una URL HTTPS absoluta. La API no debe exponer selecciones sin publicar. El backend define la zona horaria de publicación y el inicio del calendario.
- `spotifyUrl` es un enlace HTTPS `open.spotify.com/track/{id-de-22-caracteres}`; `null` indica que no hay enlace disponible. Los fixtures usan una portada relativa `/fixtures/` y no tienen enlace de escucha.

Las respuestas malformadas muestran un error en lugar de canciones incompletas. Los enlaces a Spotify abren otra pestaña. El frontend no hace llamadas a las API de Spotify, OpenAI o X/Twitter.

## Cloudflare Pages

Compilar como SPA estática con `npm run build`. La carpeta de salida es `dist/365-tracks/browser`. Configurar Node.js según `.nvmrc`, apuntar el entorno de API al backend real y habilitar el origen del frontend en CORS. El `index.html` raíz de Angular y la ausencia de un `404.html` raíz permiten que el fallback SPA nativo de Cloudflare Pages sirva las rutas profundas. `public/_headers` define encabezados básicos de respuesta.

No se configura cuenta de Cloudflare, proyecto Pages, despliegue de producción ni despliegue automático. Cuando se autorice el hosting, se puede subir el build estático mediante Direct Upload para evitar despliegues automáticos por Git.

Referencia: [Compatibilidad de Angular](https://angular.dev/reference/versions), [Angular en Cloudflare](https://developers.cloudflare.com/pages/framework-guides/deploy-an-angular-site/), [Rutas SPA en Pages](https://developers.cloudflare.com/pages/configuration/serving-pages/#single-page-application-spa-rendering).
