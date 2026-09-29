// API_CONTRACT 3.3 이벤트 17종. 파일 1개 = 이벤트 1종. 등록은 registry.registerAll(ALL_SSE_HANDLERS)
import type { SseHandler } from '../registry';
import { chatDmHandler } from './chat.dm';
import { chatDmReadHandler } from './chat.dm.read';
import { chatDmRecalledHandler } from './chat.dm.recalled';
import { chatGroupHandler } from './chat.group';
import { chatPublicHandler } from './chat.public';
import { groupJoinedHandler } from './group.joined';
import { groupRemovedHandler } from './group.removed';
import { groupUpdatedHandler } from './group.updated';
import { presenceJoinedHandler } from './presence.joined';
import { presenceLeftHandler } from './presence.left';
import { presenceUpdatedHandler } from './presence.updated';
import { syncRequiredHandler } from './sync.required';
import { systemHeartbeatHandler } from './system.heartbeat';
import { systemNoticeHandler } from './system.notice';
import { systemSuspendedHandler } from './system.suspended';
import { worldPositionsHandler } from './world.positions';
import { worldSnapshotHandler } from './world.snapshot';

export const ALL_SSE_HANDLERS: readonly SseHandler[] = [
  worldSnapshotHandler,
  worldPositionsHandler,
  presenceJoinedHandler,
  presenceLeftHandler,
  presenceUpdatedHandler,
  chatPublicHandler,
  chatDmHandler,
  chatDmRecalledHandler,
  chatDmReadHandler,
  chatGroupHandler,
  groupJoinedHandler,
  groupUpdatedHandler,
  groupRemovedHandler,
  systemNoticeHandler,
  systemSuspendedHandler,
  systemHeartbeatHandler,
  syncRequiredHandler,
];

export {
  worldSnapshotHandler,
  worldPositionsHandler,
  presenceJoinedHandler,
  presenceLeftHandler,
  presenceUpdatedHandler,
  chatPublicHandler,
  chatDmHandler,
  chatDmRecalledHandler,
  chatDmReadHandler,
  chatGroupHandler,
  groupJoinedHandler,
  groupUpdatedHandler,
  groupRemovedHandler,
  systemNoticeHandler,
  systemSuspendedHandler,
  systemHeartbeatHandler,
  syncRequiredHandler,
};
