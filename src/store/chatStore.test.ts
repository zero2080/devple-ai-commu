import { beforeEach, describe, expect, it } from 'vitest';

import type { ChatPublicEvent, PublicMessage } from '@/domain';

import { dmThreadKey, groupThreadKey, PUBLIC_LOG_LIMIT, useChatStore } from './chatStore';

const NOW = 1_700_000_000_000;

function message(
  id: string,
  senderId: string,
  content: string,
  links: string[] = [],
): PublicMessage {
  return {
    id,
    kind: 'public',
    senderId,
    content,
    links,
    createdAt: NOW,
    position: { mapId: 'main', x: 1, y: 1, dir: 'down' },
  };
}

function event(
  id: string,
  senderId: string,
  content: string,
  links: string[] = [],
): ChatPublicEvent {
  return {
    ...message(id, senderId, content, links),
    sender: { nickname: `nick-${senderId}`, avatarId: 'char_01' },
  };
}

const chat = () => useChatStore.getState();

beforeEach(() => {
  chat().reset();
});

describe('receivePublic', () => {
  it('로그에 닉네임 스냅샷과 함께 쌓고 말풍선을 만든다', () => {
    chat().receivePublic(event('m1', 'a', '안녕'), 'me', NOW);
    expect(chat().publicLog).toEqual([
      {
        id: 'm1',
        senderId: 'a',
        senderNickname: 'nick-a',
        content: '안녕',
        links: [],
        createdAt: NOW,
      },
    ]);
    expect(chat().bubbles).toEqual([
      {
        id: 'm1',
        userId: 'a',
        content: '안녕',
        links: [],
        variant: 'public',
        expiresAt: NOW + 3100,
      },
    ]);
  });

  it('같은 id는 한 번만 받는다', () => {
    chat().receivePublic(event('m1', 'a', '안녕'), 'me', NOW);
    chat().receivePublic(event('m1', 'a', '안녕'), 'me', NOW + 5);
    expect(chat().publicLog).toHaveLength(1);
  });

  it('같은 사람의 새 발화는 말풍선을 대체한다 (사용자당 1개)', () => {
    chat().receivePublic(event('m1', 'a', '첫째'), 'me', NOW);
    chat().receivePublic(event('m2', 'b', '다른 사람'), 'me', NOW);
    chat().receivePublic(event('m3', 'a', '둘째'), 'me', NOW);
    expect(chat().bubbles.map((b) => b.id)).toEqual(['m2', 'm3']);
  });

  it('링크가 있으면 말풍선이 최소 6초 유지된다', () => {
    chat().receivePublic(event('m1', 'a', '봐 https://x.io', ['https://x.io']), 'me', NOW);
    expect(chat().bubbles[0]?.expiresAt).toBe(NOW + 6000);
  });

  it(`로그는 최근 ${String(PUBLIC_LOG_LIMIT)}개만 남긴다`, () => {
    for (let i = 0; i < PUBLIC_LOG_LIMIT + 5; i += 1) {
      chat().receivePublic(event(`m${String(i)}`, 'a', String(i)), 'me', NOW);
    }
    expect(chat().publicLog).toHaveLength(PUBLIC_LOG_LIMIT);
    expect(chat().publicLog[0]?.id).toBe('m5');
  });
});

describe('내 공개 메시지 확정 (POST 201 vs SSE, 먼저 온 쪽)', () => {
  it('SSE가 먼저 오면 NFC 본문이 같은 가장 오래된 sending을 해소하고, 뒤늦은 201은 중복을 만들지 않는다', () => {
    const t1 = chat().addPending('가나', NOW);
    const t2 = chat().addPending('가나', NOW + 1);
    chat().receivePublic(event('m1', 'me', '가나'), 'me', NOW + 10); // 분리형 = NFC '가나'
    expect(chat().pendingPublic.map((p) => p.tempId)).toEqual([t2]);
    expect(chat().publicLog).toHaveLength(1);

    chat().confirmPending(t1, message('m1', 'me', '가나'), '나', NOW + 20);
    expect(chat().publicLog).toHaveLength(1);
    expect(chat().bubbles).toHaveLength(1);
  });

  it('201이 먼저 오면 로그·말풍선을 만들고, 뒤늦은 SSE는 무시된다', () => {
    const t1 = chat().addPending('안녕', NOW);
    chat().confirmPending(t1, message('m1', 'me', '안녕'), '데모', NOW + 5);
    expect(chat().pendingPublic).toEqual([]);
    expect(chat().publicLog[0]).toMatchObject({ id: 'm1', senderNickname: '데모' });
    chat().receivePublic(event('m1', 'me', '안녕'), 'me', NOW + 10);
    expect(chat().publicLog).toHaveLength(1);
  });

  it('남의 메시지는 내 pending을 해소하지 않는다', () => {
    chat().addPending('안녕', NOW);
    chat().receivePublic(event('m1', 'a', '안녕'), 'me', NOW);
    expect(chat().pendingPublic).toHaveLength(1);
  });

  it('실패 → 다시 보내기 → 지우기 흐름. 실패하지 않은 항목은 지워지지 않는다', () => {
    const t1 = chat().addPending('안녕', NOW);
    chat().dismissPending(t1);
    expect(chat().pendingPublic).toHaveLength(1); // sending은 지울 수 없음

    chat().failPending(t1, 'RATE_LIMITED');
    expect(chat().pendingPublic[0]).toMatchObject({ status: 'failed', errorCode: 'RATE_LIMITED' });
    chat().markSending(t1);
    expect(chat().pendingPublic[0]).toEqual({
      tempId: t1,
      content: '안녕',
      status: 'sending',
      createdAt: NOW,
    });
    chat().failPending(t1, 'INTERNAL');
    chat().dismissPending(t1);
    expect(chat().pendingPublic).toEqual([]);
  });
});

describe('removeBubble / reset', () => {
  it('말풍선을 지우고 reset은 전부 비운다', () => {
    chat().receivePublic(event('m1', 'a', '안녕'), 'me', NOW);
    chat().addPending('x', NOW);
    chat().removeBubble('m1');
    expect(chat().bubbles).toEqual([]);
    chat().reset();
    expect(chat().publicLog).toEqual([]);
    expect(chat().pendingPublic).toEqual([]);
  });
});

describe('DM 말풍선·pendingThread', () => {
  it('showBubble은 variant를 지정해 같은 사용자의 말풍선을 대체한다 (공개·DM 공통 1개)', () => {
    chat().receivePublic(event('m1', 'a', '공개'), 'me', NOW);
    chat().showBubble({ id: 'dm1', userId: 'a', content: '귓속말', links: [] }, 'dm', NOW);
    expect(chat().bubbles).toEqual([
      {
        id: 'dm1',
        userId: 'a',
        content: '귓속말',
        links: [],
        variant: 'dm',
        expiresAt: NOW + 3150,
      },
    ]);
  });

  it('에코가 먼저 오면 같은 스레드·같은 본문(NFC)의 가장 오래된 sending만 해소한다', () => {
    const peer = dmThreadKey('peer');
    const t1 = chat().addPendingThread(peer, '가나', NOW);
    const t2 = chat().addPendingThread(peer, '가나', NOW + 1);
    chat().addPendingThread(groupThreadKey('peer'), '가나', NOW + 2);
    chat().resolvePendingThreadByEcho(peer, '\u1100\u1161나');
    expect(chat().pendingThread.map((p) => p.tempId)).toEqual([
      t2,
      expect.stringMatching(/^tmpth_/),
    ]);
    chat().removePendingThread(t2);
    // 같은 id라도 DM 스레드와 그룹 스레드는 다른 키
    expect(chat().pendingThread.map((p) => p.threadKey)).toEqual(['group:peer']);
    expect(t1).not.toBe(t2);
  });

  it('실패 → 다시 보내기 → 실패 → 지우기, sending은 지우지 않는다', () => {
    const t = chat().addPendingThread(dmThreadKey('peer'), '안녕', NOW);
    chat().dismissPendingThread(t);
    expect(chat().pendingThread).toHaveLength(1);
    chat().failPendingThread(t, 'FORBIDDEN');
    expect(chat().pendingThread[0]).toMatchObject({ status: 'failed', errorCode: 'FORBIDDEN' });
    chat().markSendingThread(t);
    expect(chat().pendingThread[0]).toEqual({
      tempId: t,
      threadKey: 'dm:peer',
      content: '안녕',
      status: 'sending',
      createdAt: NOW,
    });
    chat().failPendingThread(t, 'INTERNAL');
    chat().dismissPendingThread(t);
    chat().reset();
    expect(chat().pendingThread).toEqual([]);
  });

  it('clearPendingThread는 그 스레드 항목만 모두 버린다 (그룹에서 빠짐)', () => {
    chat().addPendingThread(groupThreadKey('g1'), '가', NOW);
    const failed = chat().addPendingThread(groupThreadKey('g1'), '나', NOW);
    chat().failPendingThread(failed, 'FORBIDDEN');
    chat().addPendingThread(groupThreadKey('g2'), '다', NOW);
    chat().clearPendingThread(groupThreadKey('g1'));
    expect(chat().pendingThread.map((p) => p.content)).toEqual(['다']);
  });
});
