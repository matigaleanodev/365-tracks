#!/usr/bin/env bash
# Regenera los PNG de marca de public/ a partir de public/daywave-mark.svg, las fuentes
# autohospedadas y los colores aprobados en DESIGN.md. No forma parte del build: los PNG se
# versionan. Requiere un Chromium o Chrome local (CHROME=/ruta/al/binario si no está en PATH).
# Uso: bash scripts/brand-assets.sh
set -euo pipefail
cd "$(dirname "$0")/.."

chrome=${CHROME:-$(command -v chromium || command -v google-chrome || command -v chrome || true)}
[[ -x "$chrome" ]] || { echo 'Definí CHROME con la ruta a Chromium o Chrome.' >&2; exit 1; }

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
cp public/fonts/newsreader-latin.woff2 public/fonts/source-sans-3-latin.woff2 "$work/"

paper='#F2EFE8' ink='#232040' muted='#5A5167' violet='#413474'
# El mismo dibujo del disco, con el centro relleno de papel para que el PNG se lea sobre fondos
# claros y oscuros (el SVG resuelve el tema con prefers-color-scheme).
record() {
  cat <<SVG
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="$1" height="$1">
  <g fill="none" stroke="$violet" stroke-width="1.75">
    <circle cx="12" cy="12" r="9.5" fill="$2"/>
    <path d="M5.75 12A6.25 6.25 0 0 1 12 5.75m6.25 6.25A6.25 6.25 0 0 1 12 18.25" stroke-linecap="round"/>
    <circle cx="12" cy="12" r="1.5" fill="$violet" stroke="none"/>
  </g>
</svg>
SVG
}

page() { # nombre ancho alto fondo contenido
  cat > "$work/$1.html" <<HTML
<!doctype html><meta charset="utf-8">
<style>
  @font-face { font-family: Newsreader; src: url(newsreader-latin.woff2) format('woff2'); font-weight: 400 700; }
  @font-face { font-family: 'Source Sans 3'; src: url(source-sans-3-latin.woff2) format('woff2'); font-weight: 400 750; }
  html, body { margin: 0; width: $2px; height: $3px; overflow: hidden; background: $4; }
  body { display: grid; place-items: center; }
</style>
$5
HTML
  "$chrome" --headless --no-sandbox --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --default-background-color=00000000 --virtual-time-budget=2000 \
    --window-size="$2,$3" --screenshot="$work/$1.png" "file://$work/$1.html" > /dev/null 2>&1
  [[ -s "$work/$1.png" ]] || { echo "No se generó $1.png" >&2; exit 1; }
}

page favicon-32 32 32 transparent "$(record 32 "$paper")"
page apple-touch-icon 180 180 "$paper" "$(record 128 "$paper")"
page icon-192 192 192 "$paper" "$(record 116 "$paper")"
page icon-512 512 512 "$paper" "$(record 308 "$paper")"

# Tarjeta social: la composición del prelanzamiento (reglas de edición, título serif y slogan).
page social-card 1200 630 "$paper" "$(cat <<HTML
<main style="box-sizing:border-box;width:1200px;height:630px;padding:64px 80px;display:flex;flex-direction:column;justify-content:space-between;font-family:'Source Sans 3',system-ui,sans-serif;color:$ink">
  <div style="display:flex;align-items:center;gap:.3em;font-size:56px;font-weight:700;letter-spacing:-.04em">
    $(record 50 "$paper") Daywave
  </div>
  <section style="border-block:3px solid $violet;padding:32px 0 40px">
    <h1 style="margin:0 0 20px;font-family:Newsreader,Georgia,serif;font-weight:520;font-size:84px;line-height:.99;letter-spacing:-.034em;text-wrap:balance">Una canción compartida cada día.</h1>
    <p lang="en" style="margin:0;font-size:36px;font-weight:600;color:$violet">One day. One song. One world.</p>
  </section>
  <p style="margin:0;font-size:28px;color:$muted">daywave.matiasgaleano.dev</p>
</main>
HTML
)"

for name in favicon-32 apple-touch-icon icon-192 icon-512 social-card; do
  cp "$work/$name.png" "public/$name.png"
done
echo 'PNG de marca actualizados en public/.'
