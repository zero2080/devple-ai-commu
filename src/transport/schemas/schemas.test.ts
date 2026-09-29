// zod 스키마 ↔ domain/types.ts 일치 검증 (ROADMAP 3단계). expectTypeOf는 tsc -b 시 타입 수준에서 검사된다.
import { describe, expect, expectTypeOf, it } from 'vitest';
import type { z } from 'zod';

import type {
  AuthSession,
  ChatDmEvent,
  ChatGroupEvent,
  ChatPublicEvent,
  DmConversation,
  DmConversationWithPeer,
  DmMessage,
  Group,
  GroupDetail,
  GroupListItem,
  GroupMember,
  GroupMemberWithUser,
  GroupMessage,
  GroupUpdatedEvent,
  MapData,
  Me,
  Message,
  Notice,
  Position,
  Presence,
  PublicMessage,
  ServerConfig,
  SignupRequest,
  User,
  UserProfile,
} from '@/domain';

import {
  authSessionSchema,
  chatDmEventSchema,
  chatGroupEventSchema,
  chatPublicEventSchema,
  dmConversationSchema,
  dmConversationWithPeerSchema,
  dmMessageSchema,
  groupDetailSchema,
  groupListItemSchema,
  groupMemberSchema,
  groupMemberWithUserSchema,
  groupMessageSchema,
  groupSchema,
  groupUpdatedEventSchema,
  mapDataSchema,
  meSchema,
  messageSchema,
  noticeSchema,
  positionSchema,
  presenceSchema,
  publicMessageSchema,
  serverConfigSchema,
  signupRequestSchema,
  sseEnvelopeSchema,
  userProfileSchema,
  userSchema,
  worldPositionsPayloadSchema,
} from './index';

describe('스키마 타입이 domain/types.ts와 1:1이다', () => {
  it('사용자·인증', () => {
    expectTypeOf<z.infer<typeof userSchema>>().toEqualTypeOf<User>();
    expectTypeOf<z.infer<typeof meSchema>>().toEqualTypeOf<Me>();
    expectTypeOf<z.infer<typeof userProfileSchema>>().toEqualTypeOf<UserProfile>();
    expectTypeOf<z.infer<typeof signupRequestSchema>>().toEqualTypeOf<SignupRequest>();
    expectTypeOf<z.infer<typeof serverConfigSchema>>().toEqualTypeOf<ServerConfig>();
    expectTypeOf<z.infer<typeof authSessionSchema>>().toEqualTypeOf<AuthSession>();
  });

  it('공간·위치', () => {
    expectTypeOf<z.infer<typeof positionSchema>>().toEqualTypeOf<Position>();
    expectTypeOf<z.infer<typeof presenceSchema>>().toEqualTypeOf<Presence>();
    expectTypeOf<z.infer<typeof mapDataSchema>>().toEqualTypeOf<MapData>();
  });

  it('메시지·그룹·공지', () => {
    expectTypeOf<z.infer<typeof publicMessageSchema>>().toEqualTypeOf<PublicMessage>();
    expectTypeOf<z.infer<typeof dmMessageSchema>>().toEqualTypeOf<DmMessage>();
    expectTypeOf<z.infer<typeof dmConversationSchema>>().toEqualTypeOf<DmConversation>();
    expectTypeOf<z.infer<typeof groupSchema>>().toEqualTypeOf<Group>();
    expectTypeOf<z.infer<typeof groupMemberSchema>>().toEqualTypeOf<GroupMember>();
    expectTypeOf<z.infer<typeof groupMessageSchema>>().toEqualTypeOf<GroupMessage>();
    expectTypeOf<z.infer<typeof messageSchema>>().toEqualTypeOf<Message>();
    expectTypeOf<z.infer<typeof noticeSchema>>().toEqualTypeOf<Notice>();
  });

  it('9장 합성 타입', () => {
    expectTypeOf<
      z.infer<typeof dmConversationWithPeerSchema>
    >().toEqualTypeOf<DmConversationWithPeer>();
    expectTypeOf<z.infer<typeof groupListItemSchema>>().toEqualTypeOf<GroupListItem>();
    expectTypeOf<z.infer<typeof groupMemberWithUserSchema>>().toEqualTypeOf<GroupMemberWithUser>();
    expectTypeOf<z.infer<typeof groupDetailSchema>>().toEqualTypeOf<GroupDetail>();
    expectTypeOf<z.infer<typeof chatPublicEventSchema>>().toEqualTypeOf<ChatPublicEvent>();
    expectTypeOf<z.infer<typeof chatDmEventSchema>>().toEqualTypeOf<ChatDmEvent>();
    expectTypeOf<z.infer<typeof chatGroupEventSchema>>().toEqualTypeOf<ChatGroupEvent>();
    expectTypeOf<z.infer<typeof groupUpdatedEventSchema>>().toEqualTypeOf<GroupUpdatedEvent>();
  });
});

describe('런타임 검증', () => {
  it('좌표는 타일 정수만 허용한다', () => {
    expect(positionSchema.safeParse({ mapId: 'main', x: 1.5, y: 2, dir: 'up' }).success).toBe(
      false,
    );
    expect(positionSchema.safeParse({ mapId: 'main', x: 1, y: 2, dir: 'up' }).success).toBe(true);
  });

  it('MapData.tileSize는 16 리터럴이다', () => {
    const base = {
      id: 'main',
      width: 2,
      height: 1,
      tileset: 'main',
      spawn: { x: 0, y: 0 },
      layers: [],
      collision: [0, 0],
    };
    expect(mapDataSchema.safeParse({ ...base, tileSize: 16 }).success).toBe(true);
    expect(mapDataSchema.safeParse({ ...base, tileSize: 32 }).success).toBe(false);
  });

  it('SSE 봉투는 payload를 unknown으로 남긴다 (2차 파싱은 registry)', () => {
    const parsed = sseEnvelopeSchema.parse({ id: '1', type: 'x', ts: 1, payload: { any: 1 } });
    expect(parsed.payload).toEqual({ any: 1 });
  });

  it('world.positions payload는 변경분 배열이다', () => {
    const result = worldPositionsPayloadSchema.safeParse({
      mapId: 'main',
      positions: [{ userId: 'u1', x: 1, y: 2, dir: 'left' }],
    });
    expect(result.success).toBe(true);
  });
});
