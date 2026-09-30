// Mock 세션 시뮬레이션 (ARCHITECTURE 9장): 운영자가 나를 정지한 상황을 흉내 낸다.
// 실제 서버: refresh 무효화 → 접속 중이면 system.suspended 전송 후 SSE 종료 (API_CONTRACT 2.8).
import { emitViaExpress } from './bridge.ts';
import { state } from './state.ts';

/** 나를 정지: 이후 REST는 403 USER_SUSPENDED, 로그인도 거부. system.suspended 방송 뒤 Express 연결을 닫는다 */
export async function suspendMe(): Promise<void> {
  state.me.status = 'suspended';
  state.session.accessToken = null;
  await emitViaExpress('system.suspended', {});
  await fetch('/__mock/disconnect', { method: 'POST' });
}
