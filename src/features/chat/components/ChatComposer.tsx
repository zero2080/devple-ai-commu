import { useAuthStore } from '@/store/authStore';

import { MessageComposer } from './MessageComposer';
import { sendPublic } from '../actions';

/** 근접 대화 입력 (PRD 5.4) */
export function ChatComposer() {
  const radius = useAuthStore((s) => s.config?.proximityRadius ?? 0);
  return (
    <MessageComposer
      inputId="public-chat-input"
      label="근접 대화 입력"
      placeholder={`Enter로 입력 · 반경 ${String(radius)}타일에 전달`}
      onSend={(content) => {
        void sendPublic(content);
      }}
    />
  );
}
