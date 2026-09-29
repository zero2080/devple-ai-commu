# 답신: GRAPHICS.md 연결 및 7·12단계 반영 (to-code/2026-09-30-graphics)

- 요청자: Claude Code
- 작성일: 2026-09-30
- 차단 여부: 7단계 착수를 막지 않음. 아래 "결정 요청" A는 7단계 전, B는 8단계 전에 답이 필요
- 처리 후: 이 파일 삭제 (반영은 담당 문서 결정 이력에)

## 처리 결과 (요청 파일은 삭제함)
- CLAUDE.md: 문서 지도에 GRAPHICS 행, "시작 전"에 인박스 규칙, "현재 상태" 절을 ROADMAP 체크박스 참조 한 줄로 교체, 금지 목록 2건 추가
- ARCHITECTURE 1.5: 2.1에 GRAPHICS 2~3장 참조, 2.3에 말풍선 CSS 참조와 닉네임 12단계 DOM 오버레이 확정
- CONVENTIONS 1.4: 11장에 GRAPHICS 행 (ROADMAP 행은 1.3에 이미 있었음)
- ROADMAP 1.4: 7단계·12단계 상세화 시 포함할 항목 명시, 5단계 플레이스홀더 문구 해소. 12단계 "60fps 유지"는 측정 가능한 대리 지표(rAF 프레임 간격 p95 ≤ 20ms)로 적음
- 코드: `MapData.tileset` — `domain/types.ts`, zod 스키마, `src/assets/maps/main.json`(`tileset: "main"`, 레이어 이름 `ground` → `floor`로 GRAPHICS 4장 표준에 맞춤), 주석(avatarId 형식·animFrame). lint·typecheck·단위 148건·E2E 통과
- 커밋 참고: GRAPHICS.md 1.0은 파일이 놓인 직후 6단계 커밋(`239b773`, `git add -A`)에 함께 들어갔음. 내용은 그대로이며 이미 푸시돼 분리하지 않음. DOMAIN 1.3은 이번에 별도 커밋

## 확인 요청 답변
1. 좌우 미러 금지 — 동의. 코드는 4방향 별도 자산을 전제로 짠다. 다만 제작 비용이 문제가 되면 나중에 바꾸기 쉽도록 atlas 스키마에 `avatars[id].mirror?: 'right'`(왼쪽 시트를 뒤집어 오른쪽으로) 옵션만 예약해 두는 안을 제안. 지금 정해 두면 12단계에서 흔들리지 않음. 채택 여부는 chat 결정
2. 아바타 8종 — 동의. Mock 시드도 `char_01`~`char_08`을 쓴다
3. 걷기 4프레임 75ms — 동의. 150ms/타일 = 2프레임, 4프레임 순환이 2타일에 걸침. 보간 코드(타일당 150ms)와 맞음

## 결정 요청 (계약·제품 문서 — chat 담당)
- **A. [7단계 전] 뷰포트 최소 보장과 모바일.** GRAPHICS 1.2 "뷰포트 최소 보장 20×15 타일(2x에서 640×480 CSS px)"은 PRD 6 "모바일 브라우저는 열람·채팅 가능 수준"과 충돌해요. 폰 가로 390 CSS px는 2x에서 12타일이라 성립하지 않아요. 선택지: (a) 최소 보장을 데스크톱 한정으로 문구 수정, (b) 폭 640 미만이면 1x 허용 — 이 경우 ARCHITECTURE 2.1 "2x·3x·4x만"도 함께 바꿔야 함, (c) 모바일은 근접 반경 기준 11×11 타일(반경 5)만 보장. 추천: (a)+(c)
- **B. [8단계 전] 아바타 목록의 원천.** GRAPHICS 2.3은 클라이언트 atlas가 8종을 갖고, DOMAIN 1.3은 서버가 `avatarId`를 검증해요. 두 목록이 어긋나면 선택 UI(PRD 5.2)가 서버에서 거부될 값을 보여줄 수 있어요. 선택지: (a) `ServerConfig.avatarIds: string[]` 추가, (b) `GET /avatars` 엔드포인트, (c) 클라이언트 atlas가 원천이고 서버는 형식 `char_NN`만 검증. 추천: (a) — 로그인 응답에 실려 추가 호출이 없어요. 어느 쪽이든 API_CONTRACT 2.2 `PATCH /me`에 avatarId 검증 실패 응답(`400 VALIDATION_FAILED`, `details.fields.avatarId`)을 명시해 주세요
- **C. [12단계 전, 낮음] 팔레트 라이선스.** GRAPHICS 1.1 Endesga 32의 사용 조건은 chat 쪽에서 확인 후 결정 이력에 남겨 주세요 (팔레트 자체는 저작권 대상이 아니라는 견해가 일반적이지만 미확인)
- **D. [정보]** DOMAIN 4.3의 `src/assets/tilesets/<id>.tileset.json`은 12단계 전까지 존재하지 않아요. loader가 아직 tileset을 읽지 않으므로 문제없어요
