# 자산 출처·라이선스 (GRAPHICS 6장)

직접 제작 또는 CC0/OFL 자산만 쓴다. 자산을 추가하면 여기에 항목을 더한다.

## 폰트

### PixelKo (`fonts/PixelKo.woff2`)
- **원본**: Galmuri11 — Copyright (c) 2019–2025 Lee Minseo (quiple@quiple.dev), https://github.com/quiple/galmuri (npm `galmuri` 2.40.3)
- **라이선스**: SIL Open Font License 1.1 (`fonts/OFL-Galmuri.txt` 원문 동봉)
- **수정본 표기**: 원본은 Reserved Font Name "Galmuri"를 선언하므로 이 부분집합(수정본)은 그 이름을 쓰지 않고 내부 family를 `PixelKo`로 바꿨다. 저작권·라이선스 name 레코드는 유지
- **변경 내용**: 한글 완성형 11,172자·호환 자모·ASCII·Latin-1 보충·일반 문장부호·화살표/박스/도형·CJK 문장부호·전각 문장부호만 남김 (한자·가나 제외). 빌드: `scripts/fonts/build-pixelko.sh`, 검수: `scripts/fonts/check-font.py`
- **크기**: 약 156 kB (상한 256 kB)

## 팔레트

### devple-32 (`palette.json`)
- **원본**: Palette: Endesga 32 by ENDESGA, https://lospec.com/palette-list/endesga-32
- **라이선스**: Lospec 페이지에 명시된 라이선스 문구 없음. 크레딧을 항상 표기한다 (GRAPHICS 1.1, 정확도 중간 — 공식 라이선스 아님)
- **변경 내용**: 32색 그대로 사용. 램프(`ramps`)·선택 그룹(`rampGroups`)은 GRAPHICS 2.7 초안으로 구성 — 12b에서 첫 아바타 제작 때 확정하며, 색을 대부분 바꾸면 "Endesga 32 기반"으로 표기를 유지한다

## 아바타 레이어

### 개발용 레이어 시트 (`sprites/avatar/**/*.png`)
- **원본**: 직접 제작 — Claude가 코드로 픽셀을 찍은 텍스트 원본 `art/source/avatar/**/*.pix`를 `pnpm art:build`가 PNG로 만든다 (ROADMAP 12b, 사용자 결정 2026-10-01)
- **라이선스**: 프로젝트 자체 자산 (외부 출처 없음)
- **변경 예정**: 12c에서 AI 생성 키트(`art/ai/`)로 만든 그림이 같은 경로를 덮어쓴다. 키트로 만든 그림을 넣을 때 쓴 생성 모델·서비스와 그 이용 약관을 여기에 기록한다
- **템플릿**: `art/templates/` (avatar-guide·key-colors·body_base)는 `pnpm art:templates`로 생성, 빌드에 포함하지 않음
