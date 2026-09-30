// MSW → Express emit 브리지 (ARCHITECTURE 9장). MSW 핸들러가 SSE 방송이 필요하면 Express의 /__mock/emit에 위임한다.
// /__mock 경로는 MSW가 통과시키고 Vite proxy가 Express로 넘긴다. 실패해도 REST 응답은 그대로 간다 (경고만).
export async function emitViaExpress(type: string, payload: unknown): Promise<void> {
  try {
    const res = await fetch('/__mock/emit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload }),
    });
    if (!res.ok) {
      console.warn(`[mock] emit bridge responded ${String(res.status)} for ${type}`);
    }
  } catch (error) {
    console.warn(`[mock] emit bridge failed for ${type}`, error);
  }
}
