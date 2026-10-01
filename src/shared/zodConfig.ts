// zod 전역 설정. main.tsx가 가장 먼저 import한다 — 모듈을 불러올 때 도는 검증(avatarAssets의 palette·catalog 등)보다 앞서야 한다.
// jitless: zod 4는 처음 검증할 때 `new Function("")`으로 eval 가능 여부를 시험하는데, 예외를 삼켜도 CSP(script-src 'self')가
// 위반으로 보고한다 (DEPLOYMENT 3.2 CSP). 시험을 건너뛰고 해석 모드로 검증한다
import { z } from 'zod';

z.config({ jitless: true });
