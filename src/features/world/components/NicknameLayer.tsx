import { useEffect, useRef } from 'react';

import { NICKNAME_LINE_HEIGHT_PX } from '@/game/constants';

import styles from './NicknameLayer.module.css';
import { useWorldFrame } from '../worldContext';

interface NicknameNode {
  el: HTMLSpanElement;
  text: string;
  /** 잰 폭 (CSS px). -1 = 다시 잰다 (글자·줌이 바뀌었거나 웹폰트가 늦게 도착) */
  width: number;
  zoom: number;
  /** 마지막으로 화면에 있던 프레임 번호 */
  seen: number;
  x: number;
  y: number;
  order: number;
  transform: string;
  zIndex: string;
}

/**
 * 닉네임 DOM 오버레이 (GRAPHICS 5.3, ARCHITECTURE 2.3). 렌더 프레임마다 화면 안 캐릭터의 노드만 만들고·지우고
 * transform을 직접 쓴다 (React 리렌더 없음). 겹침은 y가 큰 캐릭터가 위, 말풍선 레이어는 이 레이어 위에 둔다
 */
export function NicknameLayer() {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const nodes = useRef(new Map<string, NicknameNode>());
  const frameNo = useRef(0);

  useEffect(() => {
    // 웹폰트(font-display: block)가 늦게 오면 폭이 바뀐다 — 다 받은 뒤 한 번 다시 잰다 (jsdom에는 FontFaceSet이 없다)
    if (!('fonts' in document)) {
      return;
    }
    let cancelled = false;
    void document.fonts.ready.then(() => {
      if (cancelled) {
        return;
      }
      for (const node of nodes.current.values()) {
        node.width = -1;
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useWorldFrame((frame) => {
    const layer = layerRef.current;
    if (layer === null) {
      return;
    }
    const map = nodes.current;
    const zoom = frame.camera.zoom;
    frameNo.current += 1;
    const current = frameNo.current;
    let order = 0;
    frame.forEachVisible((userId, nickname, x, y) => {
      let node = map.get(userId);
      if (node === undefined) {
        const el = document.createElement('span');
        el.className = styles.nickname ?? '';
        el.dataset.userId = userId;
        layer.append(el);
        node = { el, text: '', width: -1, zoom, seen: 0, x, y, order, transform: '', zIndex: '' };
        map.set(userId, node);
      }
      if (node.text !== nickname) {
        node.el.textContent = nickname; // plain text만 (HTML 해석 없음)
        node.text = nickname;
        node.width = -1;
      }
      if (node.zoom !== zoom) {
        node.zoom = zoom;
        node.width = -1;
      }
      node.seen = current;
      node.x = x;
      node.y = y;
      node.order = order;
      order += 1;
    });
    for (const [userId, node] of map) {
      if (node.seen !== current) {
        node.el.remove(); // 화면 밖·퇴장한 캐릭터의 노드는 두지 않는다
        map.delete(userId);
      }
    }
    // 읽기를 먼저 모두 끝내고 쓴다 (레이아웃 스래싱 방지)
    for (const node of map.values()) {
      if (node.width < 0) {
        node.width = node.el.offsetWidth;
      }
    }
    for (const node of map.values()) {
      // 가운데 정렬도 월드 px 격자(줌의 배수)에 맞춘다 (GRAPHICS 1.2 — 서브픽셀 금지)
      const left = node.x - Math.round(node.width / 2 / zoom) * zoom;
      const top = node.y - NICKNAME_LINE_HEIGHT_PX * zoom;
      const transform = `translate(${String(left)}px, ${String(top)}px)`;
      if (node.transform !== transform) {
        node.el.style.transform = transform;
        node.transform = transform;
      }
      const zIndex = String(node.order);
      if (node.zIndex !== zIndex) {
        node.el.style.zIndex = zIndex;
        node.zIndex = zIndex;
      }
    }
  });

  // 캔버스의 aria-label과 프로필 카드가 같은 정보를 주므로 보조기기에는 숨긴다
  return (
    <div ref={layerRef} className={styles.layer} aria-hidden="true" data-testid="nickname-layer" />
  );
}
