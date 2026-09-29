// MSW 핸들러 33개 = API_CONTRACT 2장 37개 - Express mock 담당 4개 (티켓·position·presence·presences, data/config.ts)
import { adminHandlers } from './admin.ts';
import { authHandlers } from './auth.ts';
import { chatHandlers } from './chat.ts';
import { dmHandlers } from './dm.ts';
import { groupsHandlers } from './groups.ts';
import { meHandlers } from './me.ts';
import { usersHandlers } from './users.ts';

export const handlers = [
  ...authHandlers,
  ...meHandlers,
  ...usersHandlers,
  ...chatHandlers,
  ...dmHandlers,
  ...groupsHandlers,
  ...adminHandlers,
];
