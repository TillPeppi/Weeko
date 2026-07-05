#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=assets/images

# draw_mark SIZE BG INK ACCENT Q OUTFILE
# Q = fraction of canvas the mark's rounded frame occupies (content is 72u wide in a 96u space)
draw_mark() {
  local S=$1 BG=$2 INK=$3 ACC=$4 Q=$5 OUTFILE=$6
  eval "$(awk -v S="$S" -v Q="$Q" '
  function X(p){ return tx + p*f }
  function Y(p){ return ty + p*f }
  BEGIN{
    f = Q*S/72;
    tx = S/2 - 48*f; ty = S/2 - 48*f;
    printf "fx1=%.2f; fy1=%.2f; fx2=%.2f; fy2=%.2f; rx=%.2f;\n", X(12),Y(12),X(84),Y(84),19*f;
    printf "swf=%.2f; sww=%.2f;\n", 5*f, 7*f;
    printf "w1x=%.2f; w1y=%.2f; w2x=%.2f; w2y=%.2f; w3x=%.2f; w3y=%.2f; w4x=%.2f; w4y=%.2f; w5x=%.2f; w5y=%.2f;\n", \
      X(31),Y(33), X(40),Y(65), X(48),Y(38), X(56),Y(65), X(65),Y(33);
  }')"
  local CANVAS="xc:${BG}"
  [ "$BG" = "none" ] && CANVAS="xc:none"
  magick -size "${S}x${S}" "$CANVAS" \
    -fill none -stroke "$INK" -strokewidth "$swf" \
    -draw "stroke-linecap round stroke-linejoin round roundrectangle ${fx1},${fy1} ${fx2},${fy2} ${rx},${rx}" \
    -fill none -stroke "$ACC" -strokewidth "$sww" \
    -draw "stroke-linecap round stroke-linejoin round path 'M ${w1x},${w1y} L ${w2x},${w2y} L ${w3x},${w3y} L ${w4x},${w4y} L ${w5x},${w5y}'" \
    -background none "$OUTFILE"
  echo "wrote $OUTFILE ($(magick identify -format '%wx%h' "$OUTFILE"))"
}

PAPER='#f4f1e9'; INK='#141519'; ACC='#3d7fd6'; WHITE='#ffffff'

draw_mark 1024 "$PAPER" "$INK" "$ACC" 0.66 "$OUT/icon.png"
draw_mark 64   "$WHITE" "$INK" "$ACC" 0.74 "$OUT/favicon.png"
draw_mark 512  none     "$INK" "$ACC" 0.80 "$OUT/splash-icon.png"
draw_mark 1024 none     "$INK" "$ACC" 0.52 "$OUT/android-icon-foreground.png"
draw_mark 432  none     "#000000" "#000000" 0.52 "$OUT/android-icon-monochrome.png"
