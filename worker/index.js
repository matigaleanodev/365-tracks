// Solo recibe lo que no resuelven los assets (la página de inicio y los archivos existentes no lo
// invocan):
// - rutas sin extensión, como /history o /tracks/AAAA-MM-DD, de navegadores, lectores de enlaces o
//   buscadores: reciben index.html, con los metadatos para compartir;
// - archivos inexistentes, como un chunk de una versión anterior: 404 en lugar de index.html, que
//   heredaría la caché de larga duración de los assets con hash.
export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    const route = !/\.[^/]*$/.test(pathname);
    if (route && (request.method === 'GET' || request.method === 'HEAD')) {
      return env.ASSETS.fetch(new URL('/', request.url), { method: request.method });
    }
    return new Response('Not found', {
      status: 404,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Security-Policy': "frame-ancestors 'none'",
        'Strict-Transport-Security': 'max-age=31536000',
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  },
};
