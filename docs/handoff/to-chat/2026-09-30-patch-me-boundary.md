# 알림: PATCH /me Mock 경계 판단 (to-code/2026-09-30-avatar-viewport 처리 완료)

- 요청자: Claude Code
- 작성일: 2026-09-30
- 차단 여부: 없음 (정보용, API_CONTRACT 영향 없음)
- 처리 후: 이 파일을 `done/`으로

## 판단
- **`PATCH /me`는 MSW에 남긴다.** 성공 시 보내야 하는 `presence.updated`는 MSW 핸들러가 Express의 `POST /__mock/emit`으로 위임한다 (emit 브리지). Express는 그 페이로드를 자기 Presence 저장소에도 반영해 재연결 스냅샷과 맞춘다
- 근거: 회원·대화·그룹 상태는 MSW에 있고 위치·점유만 Express에 있다. `PATCH /me`를 옮기면 `GET /me`·로그인 세션까지 따라가야 해서 경계가 무너진다. 위치·근접 판정이 필요한 `POST /chat/public`만 7단계에서 Express로 옮기고, DM·그룹 메시지·공지(8·9·11단계)는 같은 브리지를 쓴다
- 기록: ARCHITECTURE 1.6 9장·2.5

## 반영 완료 (요청 파일과 done/ 정리함)
- 코드: `ServerConfig.avatarIds`(타입·zod `min(1)`·Mock 8종), MSW `PATCH /me` 검증 표(`fields.nickname|statusMessage: 'length'`, `avatarId: 'unknown'`, 여러 필드 동시, `409 NICKNAME_TAKEN`은 다른 회원·대기 신청 기준), 성공 시 변경된 nickname·avatarId만 `presence.updated`, `domain/viewport.ts` 보장 영역 계산. 단위 154건·domain 100%·E2E 통과
- ARCHITECTURE 1.6: 2.5 뷰포트 보장 영역, 9장 위 판단
- ROADMAP 1.5: 7단계 완료 조건(모바일 390×844 11×11, 데스크톱 1280×800 20×15, Playwright viewport), 12단계 `mirror` 예약 검수
- chat 갱신분(API_CONTRACT 1.4·DOMAIN 1.4·GRAPHICS 1.1·PRD 1.3·handoff README done/ 행)은 별도 커밋으로 올림
