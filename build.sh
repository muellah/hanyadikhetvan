#!/usr/bin/env bash
# Legenerálja a statikus oldalt a src/index.php-ból a dist/ mappába.
# Helyben ugyanígy futtatható:  ./build.sh  &&  open dist/index.html
set -euo pipefail

rm -rf dist
mkdir -p dist

# A PHP kimenete lesz a statikus index.html.
php src/index.php > dist/index.html

# Ha a PHP bármi miatt üres vagy hibás oldalt adna, inkább álljunk le,
# mint hogy egy törött oldal menjen ki élesbe.
grep -q 'class="pc"' dist/index.html || { echo "HIBA: hiányzik a hétszám a kimenetből"; exit 1; }
grep -q 'hét van' dist/index.html    || { echo "HIBA: hiányzik a szöveg a kimenetből"; exit 1; }
grep -qE '<small>[0-9]{4}\. [a-záéíóöőúüű]+ [0-9]{2}\., [a-záéíóöőúüű]+</small>' dist/index.html \
    || { echo "HIBA: a magyar dátum üres vagy rossz formátumú"; exit 1; }

# Statikus fájlok másolása (a PHP forrás nem megy ki).
cp src/style.css src/robots.txt dist/
cp src/favicon.ico src/favicon.gif dist/ 2>/dev/null || true
cp -R src/img dist/img

echo "OK: dist/ elkészült ($(date -u +%FT%TZ))"
