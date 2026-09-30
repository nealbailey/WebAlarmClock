#!/usr/bin/env bash
# Regenerates js/sounds.js from whatever MP3s are sitting in sounds/.
set -euo pipefail

cd "$(dirname "$0")/.."

{
  echo "// Regenerate with: tools/build-sounds.sh"
  echo "const SOUNDS = ["
  first=1
  for path in sounds/*.mp3; do
    file="$(basename "$path")"
    label="$(basename "$file" .mp3 |
      sed -e 's/[-_]/ /g' -e 's/\([a-z]\)\([A-Z]\)/\1 \2/g' -e 's/\([A-Za-z]\)\([0-9]\)/\1 \2/g' -e 's/^./\U&/')"
    case "$file" in
      XFiles.mp3) label="X-Files" ;;
      ding1.mp3)  label="Ding" ;;
    esac
    [[ $first -eq 0 ]] && echo ","
    first=0
    printf '  { file: "%s", label: "%s" }' "$file" "$label"
  done
  echo
  echo "];"
  echo
  echo "const DEFAULT_SOUND = \"Simpsons.mp3\";"
} > js/sounds.js

echo "Wrote js/sounds.js"
