#!/bin/bash

ASSETS_DIR="$(dirname "$0")/assets"
DATA_FILE="$(dirname "$0")/data.json"
PARALLEL=4

mkdir -p "$ASSETS_DIR"

# Write URLs-to-download to a temp file
PENDING=$(mktemp)
trap 'rm -f "$PENDING"' EXIT

rg -o 'https://i\.imgur\.com/[A-Za-z0-9]+\.(jpg|png)' "$DATA_FILE" | sort -u | while read -r url; do
  fn=$(basename "$url")
  [ ! -f "$ASSETS_DIR/$fn" ] && echo "$url"
done > "$PENDING"

TOTAL=$(wc -l < "$PENDING" | tr -d ' ')
if [ "$TOTAL" -eq 0 ]; then
  echo "All images already downloaded."
  exit 0
fi

echo "Downloading $TOTAL remaining images ($PARALLEL concurrent)..."

download_one() {
  local url="$1"
  local filename
  filename=$(basename "$url")
  if curl -sS -L --connect-timeout 10 --max-time 60 -o "$ASSETS_DIR/$filename" "$url" 2>/dev/null; then
    fsize=$(stat -f%z "$ASSETS_DIR/$filename" 2>/dev/null || stat --printf="%s" "$ASSETS_DIR/$filename" 2>/dev/null)
    if [ "$fsize" -gt 1000 ]; then
      echo "[OK] $filename ($fsize bytes)"
    else
      echo "[FAIL] $filename (too small: $fsize bytes)"
      rm -f "$ASSETS_DIR/$filename"
    fi
  else
    echo "[FAIL] $filename (curl failed)"
    rm -f "$ASSETS_DIR/$filename"
  fi
}
export -f download_one
export ASSETS_DIR

xargs -P "$PARALLEL" -I {} bash -c 'download_one "$@"' _ {} < "$PENDING"

OK=$(ls "$ASSETS_DIR" | wc -l | tr -d ' ')
echo "Done. $OK total files in assets/."
