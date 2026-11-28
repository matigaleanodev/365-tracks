# Daywave

Frontend público Angular standalone, TypeScript strict y SCSS. Leer también el AGENTS.md administrativo del workspace en los directorios padre si está disponible.

- Estado local con signals privados, exposición readonly y derivados con computed. RxJS para HTTP y cancelación de solicitudes.
- Usar inject(), OnPush, control flow moderno e inputs/outputs readonly. Miembros exclusivos de lógica privados, miembros de templates protected.
- La selección y la fecha del día las determina 365-tracks-api. No seleccionar canciones según la fecha o zona horaria del navegador.
- Mantener fixtures en src/app/dev y dev-assets; solo la configuración fixtures puede incluirlos.
- No agregar autenticación, reproducción, administración ni integraciones directas con Spotify, OpenAI o redes sociales.
- Validar con npm run lint, npm run format:check, npm test y npm run build.
- README.md y README.es.md contienen la referencia técnica en inglés y español.

## Flujo Git

- `dev` es la rama predeterminada y la base de todo desarrollo. Crear desde `dev` únicamente ramas `feat/<tema>` o `fix/<tema>` y devolverlas mediante PR a `dev`.
- Para publicar una versión, crear `release/x.x.x` desde `dev` y abrir PR hacia `main`. No integrar `dev`, `feat/` ni `fix/` directamente en `main`.
- Fuera de `dev` y `main`, solo se permiten los prefijos `feat/`, `fix/` y `release/`; no usar `codex/`. Verificar el nombre antes de crear una rama.
- `dev` y `main` requieren PR, CI y el control `branch-policy` aprobados, conversaciones resueltas y merge commit. No hacer push directo, force-push ni borrar estas ramas.
- Conservar commits pequeños y descriptivos. Títulos de commits y PR semánticos en español; cuerpo del PR concreto con alcance y validación.
- Commit, push, merge, release y despliegue requieren autorización del pedido vigente; este archivo no los autoriza por sí solo.
- Tras un merge autorizado, eliminar la rama remota integrada una vez comprobado que no queden cambios ni integraciones pendientes. Conservar ramas destino, tags y ramas locales.
