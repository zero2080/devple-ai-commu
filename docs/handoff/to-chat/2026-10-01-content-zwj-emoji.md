---
id: 2026-10-01-content-zwj-emoji
from: server
to: chat
blocks: S-6
needs-user: false
---
## info
- Found while implementing server S2 `TextRules`. DOMAIN 5.1 contradicts itself:
  - It says content is "출력 가능 문자 + 이모지 + 줄바꿈".
  - The same rule forbids "U+200B~U+200F". That range contains U+200D ZERO WIDTH JOINER.
  - ZWJ builds sequence emoji: 👨‍👩‍👧 = U+1F468 U+200D U+1F469 U+200D U+1F467, and 🏳️‍🌈, 🧑‍💻, ❤️‍🔥. Under the current text, every such message is rejected with `400 MESSAGE_INVALID_CONTENT`.
- Interim: server S2 follows the explicit text and rejects U+200D. No message endpoint exists before S6.
- Also under-specified ("등"). The server's actual forbidden set (server ARCHITECTURE 7.1) is:
  - content: C0 except LF, U+007F, C1 U+0080–U+009F, U+200B–U+200F, U+202A–U+202E, U+2060–U+2064, U+2066–U+2069, U+FEFF, unpaired surrogates.
  - nickname: the same set, plus LF and TAB.
  - The frontend nickname pre-check (`signup.ts`) only checks C0, U+007F and U+200B–U+200F. It accepts e.g. U+202E (RTL override), which the server rejects with `invalid`.
- Length: the server counts code points of the NFC value. The frontend counts the raw input. These differ only for decomposed input (e.g. NFD Hangul).

## decide
- Q1: is ZWJ allowed in message/notice content?
  - A (recommended): allow U+200D in content. Keep it forbidden in nicknames, which are one line and an impersonation risk. Simple, and every sequence emoji works.
  - B: allow U+200D only between two emoji code points. More precise, but needs an emoji property table in two codebases.
  - C: keep forbidding it (document that sequence emoji are unsupported).
- Q2: write the exact forbidden sets above into DOMAIN 5.1 and 8 instead of "등", so that frontend pre-checks can match. Recommendation: yes. Once it is fixed, code can align `signup.ts`.
- Q3: state that length is measured on the NFC value. Recommendation: yes. The server stores NFC.
