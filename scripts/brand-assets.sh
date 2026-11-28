#!/usr/bin/env bash
# Regenera los PNG de marca de public/ a partir de las fuentes SVG únicas de la marca:
# public/daywave-mark.svg (isotipo) y public/favicon.svg (simplificación óptica para pestañas).
# Los PNG usan la paleta clara: el SVG la trae como valor por defecto de --brand-*.
# No forma parte del build: los PNG se versionan. Requiere un Chromium o Chrome local
# (CHROME=/ruta/al/binario si no está en PATH).
# Uso: bash scripts/brand-assets.sh
set -euo pipefail
cd "$(dirname "$0")/.."

chrome=${CHROME:-$(command -v chromium || command -v google-chrome || command -v chrome || true)}
[[ -x "$chrome" ]] || { echo 'Definí CHROME con la ruta a Chromium o Chrome.' >&2; exit 1; }

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
cp public/daywave-mark.svg public/favicon.svg "$work/"
cp public/fonts/newsreader-latin.woff2 public/fonts/source-sans-3-latin.woff2 "$work/"
# La marca se dibuja solo en los SVG de public/. Comprobar que el isotipo conserve su símbolo.
grep -q 'id="record"' "$work/daywave-mark.svg" || { echo 'daywave-mark.svg sin #record.' >&2; exit 1; }

paper='#F2EFE8' ink='#232040' muted='#5A5167' violet='#413474'
mark() { echo "<img src=\"daywave-mark.svg\" width=\"$1\" height=\"$1\" alt=\"\">"; }

page() { # nombre ancho alto fondo contenido
  cat > "$work/$1.html" <<HTML
<!doctype html><meta charset="utf-8">
<style>
  @font-face { font-family: Newsreader; src: url(newsreader-latin.woff2) format('woff2'); font-weight: 400 700; }
  @font-face { font-family: 'Source Sans 3'; src: url(source-sans-3-latin.woff2) format('woff2'); font-weight: 400 750; }
  :root { color-scheme: light; }
  html, body { margin: 0; width: $2px; height: $3px; overflow: hidden; background: $4; }
  body { display: grid; place-items: center; }
  img { display: block; }
</style>
$5
HTML
  "$chrome" --headless --no-sandbox --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --default-background-color=00000000 --virtual-time-budget=2000 --force-color-profile=srgb \
    --blink-settings=preferredColorScheme=1 \
    --window-size="$2,$3" --screenshot="$work/$1.png" "file://$work/$1.html" > /dev/null 2>&1
  [[ -s "$work/$1.png" ]] || { echo "No se generó $1.png" >&2; exit 1; }
}

page favicon-32 32 32 transparent '<img src="favicon.svg" width="32" height="32" alt="">'
page apple-touch-icon 180 180 "$paper" "$(mark 140)"
page icon-192 192 192 "$paper" "$(mark 150)"
page icon-512 512 512 "$paper" "$(mark 400)"

# Tarjeta social: lockup de marca y la composición del prelanzamiento (reglas, título serif y slogan).
page social-card 1200 630 "$paper" "$(cat <<HTML
<main style="box-sizing:border-box;width:1200px;height:630px;padding:64px 80px;display:flex;flex-direction:column;justify-content:space-between;font-family:'Source Sans 3',system-ui,sans-serif;color:$ink">
  <div style="display:flex;align-items:center;gap:.2em;font-size:56px;font-weight:600;letter-spacing:-.02em">
    $(mark 50) daywave
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
