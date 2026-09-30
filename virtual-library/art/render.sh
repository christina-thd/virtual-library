#!/bin/sh
# Renders the Home Assistant store images from the SVG sources:
#   icon.png  128×128  ← public/img/logo.svg
#   logo.png  250×100  ← art/store-logo.svg
#   public/img/icon-{180,192,512}.png  home-screen icons ← public/img/logo.svg
#
# Runs in a throwaway container, from the add-on folder:
#   docker run --rm -v "$PWD:/addon" -w /addon alpine:3.20 sh art/render.sh
set -e

apk add --no-cache -q rsvg-convert fontconfig >/dev/null
mkdir -p /usr/share/fonts/fraunces
wget -q -O /usr/share/fonts/fraunces/Fraunces.ttf \
  "https://github.com/google/fonts/raw/main/ofl/fraunces/Fraunces%5BSOFT,WONK,opsz,wght%5D.ttf"
fc-cache -f >/dev/null

rsvg-convert -w 128 -h 128 public/img/logo.svg -o icon.png

# home-screen icons (web app manifest and iOS "Add to Home Screen")
for size in 180 192 512; do
  rsvg-convert -w "$size" -h "$size" public/img/logo.svg -o "public/img/icon-$size.png"
done

# rsvg only loads images next to (or below) the SVG, so render the banner from a temp folder
work=$(mktemp -d)
cp public/img/logo.svg "$work/logo.svg"
sed 's#\.\./public/img/logo\.svg#logo.svg#g' art/store-logo.svg > "$work/store-logo.svg"
rsvg-convert -w 250 -h 100 "$work/store-logo.svg" -o logo.png
rm -rf "$work"

echo "icon.png, logo.png and home-screen icons updated"
