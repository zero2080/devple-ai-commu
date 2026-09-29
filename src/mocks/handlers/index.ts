// MSW 핸들러 36개 = API_CONTRACT 2장 37개 - SSE 티켓 1개 (Express mock 담당)
import { adminHandlers } from './admin.ts';
import { authHandlers } from './auth.ts';
import { chatHandlers } from './chat.ts';
import { dmHandlers } from './dm.ts';
import { groupsHandlers } from './groups.ts';
import { meHandlers } from './me.ts';
import { usersHandlers } from './users.ts';
import { worldHandlers } from './world.ts';

export const handlers = [
  ...authHandlers,
  ...meHandlers,
  ...usersHandlers,
  ...worldHandlers,
  ...chatHandlers,
  ...dmHandlers,
  ...groupsHandlers,
  ...adminHandlers,
];
