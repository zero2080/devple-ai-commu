// E2E가 읽는 DEV 전용 전역 (src/shared/debug.ts, EventSource 추적은 spec의 addInitScript)
interface DevpleWorldState {
  revision: number;
  snapshotRevision: number;
  sseState: string;
  myPosition: { mapId: string; x: number; y: number; dir: string } | null;
  presences: Map<string, { userId: string; position: { x: number; y: number } }>;
}

interface DevpleDebugGlobal {
  worldStore: { getState: () => DevpleWorldState };
  game?: { currentCamera: { originX: number; originY: number; zoom: number } };
}

interface DevpleMockControls {
  dmFrom: (userId: string, content: string) => string | null;
  readBy: (userId: string) => number;
  seedDm: (userId: string, count: number) => number;
}

interface Window {
  __devple?: DevpleDebugGlobal;
  __devpleMock?: DevpleMockControls;
  __esStats?: () => { created: number; open: number };
}
