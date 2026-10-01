#!/usr/bin/env bash
# Сжимает фото и делает две WebP-версии для сайта:
#   photos/<имя>.webp     — до 1200 px по длинной стороне (модальное окно)
#   photos/<имя>-sm.webp  — до 600 px (карточка в каталоге)
# Оригинал не трогается.
#
# Использование:  tools/optimize-photo.sh photos/originals/IMG_1234.jpg olive-les-sorts-3
# Нужен ImageMagick (convert): sudo apt install imagemagick  /  brew install imagemagick
set -euo pipefail
src="$1"; name="$2"
dir="$(cd "$(dirname "$0")/.." && pwd)/photos"
convert "$src" -auto-orient -strip -resize '1200x1200>' -quality 78 "$dir/$name.webp"
convert "$src" -auto-orient -strip -resize '600x600>'   -quality 74 "$dir/$name-sm.webp"
ls -lh "$dir/$name.webp" "$dir/$name-sm.webp"
