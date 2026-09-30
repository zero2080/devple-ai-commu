#!/bin/bash
# PixelKo = Galmuri11 (OFL 1.1, Reserved Font Name "Galmuri") 의 한글·자모·라틴·문장부호 부분집합 + 내부 이름 변경.
# 실행: bash scripts/fonts/build-pixelko.sh   (macOS/Linux, python3·npm 필요. fontTools는 .fonttools/ venv에 설치)
# 산출: src/assets/fonts/PixelKo.woff2, src/assets/fonts/OFL-Galmuri.txt. 검수는 check-font.py.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT/src/assets/fonts"
VENV="$ROOT/.fonttools"
WORK="$(mktemp -d)"
GALMURI_VERSION="${GALMURI_VERSION:-2.40.3}"
# GRAPHICS 5.1: 한글 완성형 + 호환 자모 + ASCII + Latin-1 보충 + 일반 문장부호 + 화살표/박스/도형 + CJK 문장부호 + 전각 문장부호
UNICODES="U+0020-007E,U+00A0-00FF,U+2000-206F,U+20A9,U+2190-21FF,U+2500-259F,U+25A0-25FF,U+3000-303F,U+3131-318E,U+AC00-D7A3,U+FF01-FF5E,U+FFE6"

if [ ! -x "$VENV/bin/pyftsubset" ]; then
  python3 -m venv "$VENV"
  "$VENV/bin/pip" install -q fonttools brotli
fi

cd "$WORK"
npm pack "galmuri@$GALMURI_VERSION" --silent >/dev/null
tar xzf galmuri-*.tgz
SRC="$WORK/package/dist"

mkdir -p "$OUT"
"$VENV/bin/pyftsubset" "$SRC/Galmuri11.woff2" --unicodes="$UNICODES" --layout-features='*' --name-IDs='*' \
  --flavor=woff2 --output-file="$WORK/PixelKo-subset.woff2"
"$VENV/bin/python" "$ROOT/scripts/fonts/rename-font.py" "$WORK/PixelKo-subset.woff2" "$OUT/PixelKo.woff2" PixelKo Regular
cp "$SRC/LICENSE.txt" "$OUT/OFL-Galmuri.txt"
"$VENV/bin/python" "$ROOT/scripts/fonts/check-font.py" "$OUT/PixelKo.woff2" PixelKo Galmuri 256
rm -rf "$WORK"
echo "done: $OUT/PixelKo.woff2 (from galmuri@$GALMURI_VERSION)"
