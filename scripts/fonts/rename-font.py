"""부분집합 폰트의 내부 이름을 바꾼다 (OFL Reserved Font Name 규칙).
name 테이블 1·16(family) → FAMILY, 4(full) → "FAMILY STYLE", 6(postscript) → "FAMILY-STYLE", 3(unique) 갱신.
0(copyright)·13(license)·14(license URL)은 그대로 둔다.
사용: python rename-font.py <in.woff2> <out.woff2> <FAMILY> <STYLE>
"""
import sys

from fontTools.ttLib import TTFont

src, dst, family, style = sys.argv[1:5]
font = TTFont(src)
for rec in font['name'].names:
    if rec.nameID in (1, 16):
        rec.string = family
    elif rec.nameID == 2 or rec.nameID == 17:
        rec.string = style
    elif rec.nameID == 4:
        rec.string = f'{family} {style}'
    elif rec.nameID == 6:
        rec.string = f'{family}-{style}'
    elif rec.nameID == 3:
        rec.string = f'{family}-{style};subset'
font.flavor = 'woff2'
font.save(dst)
print(f'renamed → {dst}')
