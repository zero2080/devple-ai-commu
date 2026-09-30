import { ChatComposer } from './ChatComposer';
import styles from './ChatPanel.module.css';
import { PublicLog } from './PublicLog';

/** 하단 근접 대화 패널 (PRD 5.4). 캔버스 아래 분할 배치로 보장 영역을 가리지 않는다 (ARCHITECTURE 2.5) */
export function ChatPanel() {
  return (
    <section className={styles.panel} aria-label="근접 대화" data-testid="chat-panel">
      <PublicLog />
      <ChatComposer />
    </section>
  );
}
