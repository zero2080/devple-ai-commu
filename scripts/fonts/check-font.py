"""동봉 폰트 검수 (GRAPHICS 5.1·8장): 한글 11,172자·ASCII 95자, 내부 이름에 예약 이름 없음, 크기 상한.
사용: python check-font.py <font.woff2> <FAMILY> <RESERVED_NAME> [maxKB=256]
종료 코드 0 = 통과.
"""
import os
import sys

from fontTools.ttLib import TTFont

path, family, reserved = sys.argv[1:4]
max_kb = int(sys.argv[4]) if len(sys.argv) > 4 else 256
font = TTFont(path)
cps = set(font.getBestCmap().keys())
hangul = sum(1 for c in cps if 0xAC00 <= c <= 0xD7A3)
ascii_ = sum(1 for c in cps if 0x20 <= c <= 0x7E)
jamo = sum(1 for c in cps if 0x3131 <= c <= 0x318E)
names = {rec.nameID: rec.toUnicode() for rec in font['name'].names if rec.platformID == 3}
size_kb = os.path.getsize(path) / 1024
problems = []
if hangul != 11172:
    problems.append(f'hangul syllables {hangul} != 11172')
if ascii_ != 95:
    problems.append(f'ascii {ascii_} != 95')
if jamo < 90:
    problems.append(f'compat jamo {jamo} < 90')
for nid in (1, 3, 4, 6, 16):
    value = names.get(nid, '')
    if reserved.lower() in value.lower():
        problems.append(f'name {nid} still contains reserved name: {value!r}')
if not names.get(1, '').startswith(family):
    problems.append(f'name 1 is {names.get(1)!r}, expected {family}')
if 13 not in names or 'Open Font License' not in names[13]:
    problems.append('license text (name 13) missing')
if size_kb > max_kb:
    problems.append(f'size {size_kb:.1f} kB > {max_kb} kB')
print(f'{path}: {size_kb:.1f} kB, hangul {hangul}, ascii {ascii_}, jamo {jamo}, family {names.get(1)!r}, unitsPerEm {font["head"].unitsPerEm}')
if problems:
    print('FAIL: ' + '; '.join(problems))
    sys.exit(1)
print('OK')
