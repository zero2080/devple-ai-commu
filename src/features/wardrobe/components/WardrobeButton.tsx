import { useUiStore } from '@/store/uiStore';

import styles from './Wardrobe.module.css';

/** 월드 왼쪽 아래 툴바의 옷장 버튼 (ROADMAP 12a) */
export function WardrobeButton() {
  return (
    <button
      type="button"
      className={styles.toolbarButton}
      onClick={() => {
        useUiStore.getState().openWardrobe();
      }}
    >
      옷장
    </button>
  );
}
