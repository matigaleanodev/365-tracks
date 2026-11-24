# 365 Tracks · Edición diaria

[English](DESIGN.en.md)

Referencia del diseño de Edición diaria. La base de estilos comparte tokens semánticos entre SCSS y Tailwind.

## Identidad

365 Tracks publica una selección musical compartida por día, acompañada de una nota breve y una salida a Spotify. La fecha, la canción y la portada componen la edición. La nota propone algo concreto para escuchar. El historial recoge las ediciones publicadas por mes.

El wordmark es **365 Tracks**, Source Sans 3, 700 en Tracks y 750 en 365, tracking −0,04 em. Los numerales llevan el acento violeta y Tracks usa el color de primer plano. Se mantiene en una línea. La aplicación usa el favicon de disco violeta. La variante de marca aprobada para el favicon representa 365 y una regla inferior sobre violeta, con cifras trazadas para mantener su silueta al reducirse. El símbolo de la nota musical, los controles de reproducción y el verde de Spotify quedan fuera de la marca. El texto de interfaz usa español rioplatense y verbos concretos.

## Fecha y número de edición

- La fuente para representar una publicación es `Track.date`, una fecha civil ISO validada. Presentar con `time[datetime]` y formato largo en español. Interpretar el valor como fecha civil en UTC para evitar un desplazamiento al día anterior.
- Para una fecha válida de 2027, número = distancia en días entre el 1 de enero y la fecha de API, más uno. Mostrar tres dígitos, desde **001** hasta **365**. Los días sin canción dejan huecos en el historial. El número de publicaciones cargadas y el huso del navegador no intervienen en esta fórmula.
- Antes del lanzamiento, mostrar la fecha de estreno sin folio. Después, «Todavía no hay canción de hoy» usa un encabezado sin fecha numérica si el estado de API no trae día autoritativo. El detalle sin canción sí puede mostrar su fecha solicitada. Fuera de 2027 se conserva la fecha y se omite el folio hasta aprobar otro ciclo.
- El diseño de prelanzamiento consume el estado ya calculado por la aplicación. Sigue el calendario vigente y anuncia «Estreno el 1 de enero de 2027». El header reduce los destinos a marca y tema en esa vista. El acceso por URL al historial conserva su comportamiento. El estado de espera tras el estreno evita prometer una hora.

## Materiales y color

Los primitivos se centralizan en un archivo CSS global. Claro usa papel cálido y tinta violeta. Oscuro usa un carbón con matiz violeta, una superficie nocturna diferenciada y una acción lavanda con texto oscuro. Las portadas mantienen sus valores originales en ambos temas.

| Rol semántico CSS   | Papel editorial          | Edición nocturna         | Uso                                               |
| ------------------- | ------------------------ | ------------------------ | ------------------------------------------------- |
| `background`        | `paper` #F2EFE8          | `night` #171620          | Lienzo                                            |
| `surface`           | `paper-deep` #E8E2D8     | `night-deep` #24222F     | Esqueleto, deshabilitado, base de arte            |
| `foreground`        | `ink` #232040            | `paper` #F2EFE8          | Títulos y texto                                   |
| `muted`             | `ink-soft` #5A5167       | `night-ink-soft` #C1B8CC | Fecha, álbum y ayuda                              |
| `accent`, `primary` | `violet` #413474         | `lilac` #B5A6E8          | Folio, enlaces, regla editorial y fondo de acción |
| `primary-text`      | `white-paper` #FFFCF8    | `night` #171620          | Texto e icono sobre acción                        |
| `primary-hover`     | `violet-hover` #352761   | `lilac-hover` #C9BBF2    | Hover                                             |
| `primary-pressed`   | `violet-pressed` #2C204E | `lilac-pressed` #A795DF  | Presión                                           |
| `hover-surface`     | `paper-lilac` #E4DEEF    | `night-lilac` #302841    | Ficha sin arte y fila interactiva                 |
| `rule`              | `ink-rule` #C6BDCB       | `night-rule` #4F4760     | Regla decorativa y perímetro de arte              |
| `control-border`    | `ink-outline` #877994    | `night-outline` #817694  | Límite de un control                              |
| `focus`             | `violet-focus` #6544A7   | `lilac-focus` #D4C2FF    | Anillo externo con separación                     |
| `error`             | `plum-error` #863450     | `pink-error` #F3B1CA     | Mensaje de error con texto                        |
| `success`           | `ink-success` #315D48    | `light-success` #A8D7BB  | Reservado para confirmación que lo requiera       |
| `warning`           | `ink-warning` #6D4B27    | `light-warning` #E8CB9D  | Reservado para advertencia que lo requiera        |

`disabled-background=surface`, `disabled-text=muted`, `selection-background=accent`, `selection-text=primary-text`, `skeleton=surface`. Para contorno y foco interactivo usar el rol fuerte, con objetivo mínimo 3:1 sobre la superficie contigua. Los separadores decorativos tienen una función de ritmo. Texto y acción se validan con mínimo 4,5:1 en cada combinación. El subrayado persistente identifica el destino activo. Los enlaces dentro del texto tienen subrayado y las etiquetas acompañan los estados funcionales.

Tema inicial en `prefers-color-scheme` y control de tres opciones **Sistema**, **Claro**, **Oscuro**. Conservar selección en `localStorage`. Sin almacenamiento, aplicar la elección en memoria y recuperar Sistema al volver. Escuchar cambios del sistema sólo cuando Sistema está elegido. Resolver la selección antes del primer pintado desde una inicialización pequeña compatible con la política de seguridad, con CSS de preferencia de sistema como fallback. El control tiene nombre accesible «Tema visual», un área de 44 px y foco visible.

## Tipografía

| Rol                               | Definición                                                                                                                                                                                                             |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Título de canción                 | Newsreader 520, 2,4–5,65 rem, interlínea 0,99, tracking −0,034 em. En 320–390 px, 2,4 rem en la muestra; preferir medida y espacio reales al escalar.                                                                  |
| Título largo                      | Newsreader 520, 2–3,5 rem según composición, interlínea 1,04. Texto entero, `overflow-wrap:anywhere`, `dir=auto`. La variante compacta se activa conservadoramente para títulos largos o cuando la medida lo requiera. |
| Encabezado de mes, sección y nota | Newsreader 520–550, 1,4–2,4 rem según nivel, interlínea 1–1,1.                                                                                                                                                         |
| Artista                           | Source Sans 3, 650, 1,12–1,55 rem, interlínea 1,16.                                                                                                                                                                    |
| Nota                              | Source Sans 3, 400, 1,065 rem/1,54, máximo 57ch, con espacio de 12 px entre párrafos.                                                                                                                                  |
| Cuerpo, controles y navegación    | Source Sans 3, 400 en cuerpo, 600–650 en controles, 1 rem/1,5.                                                                                                                                                         |
| Fecha, metadatos y folio          | Source Sans 3, 0,875–0,9375 rem, 400–700. Cifras tabulares para folio y fecha de fila.                                                                                                                                 |

Newsreader (Production Type) y Source Sans 3 (Adobe) usan SIL OFL 1.1. Conservar avisos y licencias de la distribución usada y respetar las condiciones sobre nombres reservados al modificar fuentes. Autohospedar WOFF2 vertical, Newsreader con tamaño óptico fijo para esta composición y eje de peso 400–700, Source Sans 3 400–750. El presupuesto propuesto es **90 KiB para latín inicial** entre ambas. Dividir Latin Extended y otros alfabetos disponibles mediante `unicode-range` para que se descarguen según contenido. Usar `font-display: swap`, sin cursivas ni precargas indiscriminadas. Preload de la serif Latin sólo si la medición de carga lo justifica. En caso de fallo, Newsreader → Georgia → Times New Roman → serif. Source Sans 3 → system-ui → sans-serif. Conservar texto, acentos, mayúsculas, dirección y caracteres de los nombres propios. Para alfabetos fuera de cobertura, usar las fuentes de sistema por carácter. Probar métricas con fuentes bloqueadas y medir CLS antes de decidir overrides de métricas. [Newsreader y su licencia](https://github.com/productiontype/Newsreader) · [Source Sans y su licencia](https://github.com/adobe-fonts/source-sans) · [Política OFL](https://openfontlicense.org/ofl-faq/)

## Grilla y forma

- Escala 4, 8, 12, 16, 20, 24, 32, 40, 48 y 64 px. Márgenes por eje en rem, contenedor hasta 76 rem, archivo hasta 60 rem. Separar encabezados, obra y nota por densidad. No usar sombras por defecto.
- Regla decorativa de 1 px, 2 px de foco y 3 px de regla de edición. Offset de foco de 3 px, radios de 2 px para arte y 4 px para botones. Sólo el salto al contenido necesita elevarse por encima del flujo.
- Menos de **36 rem**: una columna, CTA antes de la portada, arte hasta 22 rem. A partir de **36 rem**: texto y arte en paralelo con columnas `minmax(0,...)`. La portada comparte posición y tamaño entre carga y publicación, haya nota o no. El título, el CTA y la nota ocupan la primera columna. A partir de **46 rem**: la portada admite hasta 32 rem. A partir de **69 rem**: se amplía la columna de arte.
- Encabezado compacto con Hoy e Historial, objetivos de al menos 44 px, destinos legibles a 320 px y reflujo antes de ocultar texto. Se usa «Historial» como etiqueta visible por continuidad y comprensión.
- Iconos propios de trazo, rejilla 24, tamaño de 18 px y trazo de 1,7 px. Flecha atrás para retorno, chevrón para navegación interna, recuadro y flecha diagonal para salida, círculo de dos mitades para tema. Decorativos cuando acompañan texto. Sin animaciones de entrada, brillo, desplazamiento ni shimmer. Transición de realimentación de color de 150 ms ease-out, instantánea con movimiento reducido.

## Patrones y estados

| Pantalla o componente     | Criterio                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hoy y detalle             | Folio y fecha → título → artista → «Escuchar en Spotify» → álbum y año → portada → nota de ancho contenido. La acción usa la URL validada de la canción y abre otra pestaña con aviso accesible. «Volver al historial» desde una fila, «Ir al historial» en enlace profundo. La nota titulada «Por qué esta canción» sólo aparece si hay contenido.                                                                  |
| Portada                   | Caja 1:1 estable. Imagen de tamaño intrínseco declarado, proporción conservada con `object-fit: contain`, paleta, recorte y contraste originales. Regla en el perímetro cuando haga falta para separar visualmente el arte del fondo. Carga prioritaria sólo para el arte principal. Miniaturas diferidas, 40 px. Alt «Portada de [álbum]» en el detalle, miniatura decorativa en filas donde hay datos suficientes. |
| Portada ausente o fallida | Ficha de superficie violeta tenue, wordmark, folio y álbum. Si no hay folio, se puede usar el año de la fecha. Etiqueta visible y accesible «Portada no disponible». El nombre completo también se muestra fuera de la ficha. Miniatura sin imagen usa una marca neutra sin repetir el día. Error y datos ausentes comparten geometría. Restaurar oportunidad de carga cuando cambie la URL.                         |
| Historial                 | Mes y año, secciones enlazadas a su heading y listas de filas descendentes. Día, miniatura, título, artista y chevrón. Usar fecha completa como alternativa para AT. Una entrada ocupa todo el ancho de la lista. Mantener cursor opaco, deduplicar por fecha y extender grupos que crucen páginas.                                                                                                                  |
| Playlists                 | Sección anual al final de Historial y enlace de salto junto al título cuando haya una URL pública configurada. Años descendentes y enlace «Playlist [año] en Spotify». Ayuda «Las canciones pueden tardar en aparecer en Spotify». Omisión de sección y enlace con configuración vacía.                                                                                                                              |
| Prelanzamiento            | Portada editorial tipográfica. «Estreno el 1 de enero de 2027», «Una canción compartida cada día.» y descripción breve.                                                                                                                                                                                                                                                                                              |
| Sin publicación           | «Todavía no hay canción de hoy» o «No hay canción para esta fecha». Enlace al historial. Sin promesa horaria. Fecha inválida mantiene un estado separado con formato esperado.                                                                                                                                                                                                                                       |
| Carga inicial             | Geometría aproximada del contenido, arte con espacio reservado, encabezado de nivel uno y mensaje visible con `role=status`. Esqueletos decorativos y estáticos. El colofón se muestra al resolver la carga inicial de la edición o el historial.                                                                                                                                                                    |
| Error inicial y reintento | Descripción directa, botón «Reintentar». Mientras espera, aspecto y semántica de pendiente, impedir repetición y conservar el foco. Éxito de navegación y reintento inicial llevan al encabezado principal.                                                                                                                                                                                                          |
| Paginación                | «Cargar más canciones», estado pendiente con filas previas intactas. Error junto al botón y reintento del mismo cursor. Éxito anuncia cantidad añadida y enfoca la primera fila nueva. El fin se anuncia, incluso si desaparece el botón.                                                                                                                                                                            |
| Historial vacío           | «Historial», «Todavía no hay canciones publicadas.» y enlace a Hoy.                                                                                                                                                                                                                                                                                                                                                  |
| 404                       | «No encontramos esta página», breve orientación y «Volver a Hoy». No se mezcla con fecha inválida ni ausencia de una fecha válida.                                                                                                                                                                                                                                                                                   |

## Foco y accesibilidad

Usar landmarks, salto al contenido, un h1 por vista y orden DOM coherente. En la transición a detalle enfocar el h1. Restaurar scroll y fila de origen al volver desde el detalle mediante el enlace contextual, el destino Historial del encabezado o Atrás, incluso desde una página incremental. Para el salto anual, enfocar el heading y conservar navegación con Tab hacia Spotify. Ante cambios automáticos en Hoy preservar el foco y anunciar la publicación sin mover al usuario. Los mensajes asíncronos utilizan `role=status` o `role=alert` con criterio y sin duplicación de anuncios. Usar `aria-current` según página o contexto, contraste WCAG 2.2 AA como criterio local, zoom con reflujo a 320 CSS px y movimiento reducido. Validar navegador, teclado y lector de pantalla en la integración. [WCAG 2.2](https://www.w3.org/TR/WCAG22/)

## Angular y Tailwind

Conservar Angular standalone, OnPush, signals de vistas, RxJS y los estados del contrato. Centralizar primitivos y roles por tema en una sola entrada de tokens. En Tailwind 4, `@theme inline` mapea namespaces a propiedades semánticas, por ejemplo:

```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-accent: var(--accent);
  --font-editorial: var(--font-display);
  --radius-control: var(--radius-control-size);
}
@theme {
  --breakpoint-edition: 46rem;
}
```

En el archivo productivo usar un nombre distinto para el primitivo de un alias del mismo namespace, como `--radius-control-size` en el ejemplo, para evitar una referencia circular. Resolver tamaño, grilla, gaps, foco, hover y motion con clases literales de Tailwind, mapeadas a roles, y reservar CSS específico para la composición editorial y ficha tipográfica. Mantener una base por capas y conservar el reset vigente durante la sesión de paridad. Importar theme y utilities sin Preflight al comienzo, con `@tailwindcss/postcss` en una entrada CSS compatible, sin meter el compilador en SCSS. Delimitar fuentes HTML y TS productivas y excluir fixtures. Evaluar soporte real del set de navegadores antes de fijar el piso de soporte. [Angular y Tailwind](https://angular.dev/guide/tailwind) · [Theme inline](https://tailwindcss.com/docs/theme#referencing-other-variables) · [Preflight](https://tailwindcss.com/docs/preflight#disabling-preflight)
