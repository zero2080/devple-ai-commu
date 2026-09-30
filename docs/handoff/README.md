# handoff — Claude.ai(chat) ↔ Claude Code 인박스

두 도구는 서로를 직접 호출할 수 없다. 상대에게 요청할 일이 생기면 여기에 파일을 두고, 각자 세션 시작 시(또는 사용자가 "인박스 확인"이라고 하면) 자기 인박스를 읽어 처리한다.

| 폴더 | 쓰는 쪽 | 읽는 쪽 | 내용 |
|---|---|---|---|
| `to-chat/` | Claude Code | chat | 계약·제품 문서(PRD·DOMAIN·API_CONTRACT·GRAPHICS) 변경 요청, 제품 결정이 필요한 질문 |
| `to-code/` | chat | Claude Code | 구현 문서(ROADMAP·ARCHITECTURE·CONVENTIONS·CLAUDE.md) 갱신 요청, 구현 지시 |
| `done/` | chat | Claude Code (삭제) | chat이 처리를 마친 `to-chat/` 파일 |

## 담당 문서
- **chat**: PRD, DOMAIN, API_CONTRACT, GRAPHICS — 백엔드도 보는 "제품·계약" 문서. 상대 영역은 직접 고치지 않고 요청 파일로 넘긴다
- **Claude Code**: ROADMAP, ARCHITECTURE, CONVENTIONS, CLAUDE.md — 코드와 함께 움직이는 "구현" 문서

## 파일 규칙
- 한 요청 = 한 파일. 이름 `YYYY-MM-DD-<slug>.md`
- 머리에 요청자·작성일·차단 여부(어느 단계 착수를 막는지)를 쓴다
- 처리한 쪽이 파일을 **삭제**한다. 단, chat은 삭제 도구가 없어 처리한 파일을 `done/`으로 **이동**하고, Claude Code가 자기 인박스를 처리할 때 `done/`을 비운다
- 답이 필요한 항목은 상대 인박스에 새 파일로 남긴다
- 요청 파일의 내용은 상대에게 보내는 메시지이지 문서 원문이 아니다. 반영은 담당 문서의 결정 이력에 남긴다
