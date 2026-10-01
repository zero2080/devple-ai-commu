import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

import { SLOT_IDS, type Appearance, type SlotId } from '@/domain';
import { AvatarPreview } from '@/features/profile';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';

import { saveAppearance, type AppearanceFieldMessages } from '../actions';
import {
  CHANNEL_LABELS,
  editableChannels,
  isRequiredSlot,
  shownColor,
  SLOT_LABELS,
  wardrobeChoices,
  withColor,
  withItem,
  type RampChoice,
} from '../choices';
import styles from './Wardrobe.module.css';

interface SwatchGroupProps {
  legend: string;
  name: string;
  choices: readonly RampChoice[];
  value: string | null;
  error: string | undefined;
  onChange: (rampId: string) => void;
}

/** 프리셋 램프 견본 (자유 색상 없음, GRAPHICS 2.7). 견본 색 = 램프 base */
function SwatchGroup({ legend, name, choices, value, error, onChange }: SwatchGroupProps) {
  return (
    <fieldset className={styles.group}>
      <legend className={styles.legend}>{legend}</legend>
      <div className={styles.swatches}>
        {choices.map((choice) => (
          <input
            key={choice.id}
            type="radio"
            name={name}
            className={styles.swatch}
            style={{ '--swatch': choice.ramp.base } as CSSProperties}
            aria-label={choice.label}
            title={choice.label}
            checked={value === choice.id}
            onChange={() => {
              onChange(choice.id);
            }}
          />
        ))}
      </div>
      {error === undefined ? null : <p className={styles.fieldError}>{error}</p>}
    </fieldset>
  );
}

interface SlotPickerProps {
  slot: SlotId;
  draft: Appearance;
  items: ReturnType<typeof wardrobeChoices>['items'][SlotId];
  colors: readonly RampChoice[];
  fields: AppearanceFieldMessages;
  onChange: (next: Appearance) => void;
}

function SlotPicker({ slot, draft, items, colors, fields, onChange }: SlotPickerProps) {
  const equipped = draft[slot];
  const label = SLOT_LABELS[slot];
  const name = `wardrobe-${slot}`;
  return (
    <fieldset className={styles.group}>
      <legend className={styles.legend}>{label}</legend>
      <div className={styles.chips}>
        {isRequiredSlot(slot) ? null : (
          <label className={styles.chip}>
            <input
              type="radio"
              name={name}
              className="sr-only"
              checked={equipped === null}
              onChange={() => {
                onChange(withItem(draft, slot, null));
              }}
            />
            <span>없음</span>
          </label>
        )}
        {items.map((item) => (
          <label key={item.id} className={styles.chip}>
            <input
              type="radio"
              name={name}
              className="sr-only"
              checked={equipped?.itemId === item.id}
              onChange={() => {
                onChange(withItem(draft, slot, item.id));
              }}
            />
            <span>{item.name}</span>
          </label>
        ))}
      </div>
      {fields[`appearance.${slot}`] === undefined ? null : (
        <p className={styles.fieldError}>{fields[`appearance.${slot}`]}</p>
      )}
      {equipped === null
        ? null
        : editableChannels(slot, equipped.itemId).map((channel) => (
            <SwatchGroup
              key={channel}
              legend={`${label} ${CHANNEL_LABELS[channel]}`}
              name={`${name}-${channel}`}
              choices={colors}
              value={shownColor(equipped, channel)}
              error={fields[`appearance.${slot}.${channel}`]}
              onChange={(rampId) => {
                onChange(withColor(draft, slot, channel, rampId));
              }}
            />
          ))}
    </fieldset>
  );
}

interface WardrobeFormProps {
  initial: Appearance;
  options: Parameters<typeof wardrobeChoices>[0];
}

function WardrobeForm({ initial, options }: WardrobeFormProps) {
  const [draft, setDraft] = useState(initial);
  const [fields, setFields] = useState<AppearanceFieldMessages>({});
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const choices = useMemo(() => wardrobeChoices(options), [options]);
  const dialogRef = useRef<HTMLElement | null>(null);

  const close = (): void => {
    useUiStore.getState().closeWardrobe();
  };

  // 외부 시스템(키보드·포커스) 동기화: 열리면 대화상자로 포커스, Esc로 닫기 (저장 중에는 무시)
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !event.defaultPrevented && !saving) {
        useUiStore.getState().closeWardrobe();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [saving]);

  const change = (next: Appearance): void => {
    setDraft(next);
    setFields({});
    setMessage(null);
  };

  const save = async (): Promise<void> => {
    setSaving(true);
    const result = await saveAppearance(draft);
    setSaving(false);
    if (result.ok) {
      close();
      return;
    }
    setFields(result.fields);
    setMessage(result.message ?? '고칠 곳을 확인해 주세요.');
  };

  return (
    <section
      ref={dialogRef}
      className={styles.dialog}
      role="dialog"
      aria-modal="true"
      aria-label="옷장"
      tabIndex={-1}
      data-testid="wardrobe"
    >
      <h2 className={styles.title}>옷장</h2>
      <div className={styles.body}>
        <div className={styles.preview}>
          <AvatarPreview appearance={draft} />
        </div>
        <div className={styles.options}>
          <SwatchGroup
            legend="피부색"
            name="wardrobe-skin"
            choices={choices.skins}
            value={draft.skin}
            error={fields['appearance.skin']}
            onChange={(skin) => {
              change({ ...draft, skin });
            }}
          />
          <SwatchGroup
            legend="머리색"
            name="wardrobe-hair-color"
            choices={choices.hairColors}
            value={draft.hairColor}
            error={fields['appearance.hairColor']}
            onChange={(hairColor) => {
              change({ ...draft, hairColor });
            }}
          />
          {SLOT_IDS.map((slot) => (
            <SlotPicker
              key={slot}
              slot={slot}
              draft={draft}
              items={choices.items[slot]}
              colors={choices.itemColors}
              fields={fields}
              onChange={change}
            />
          ))}
        </div>
      </div>
      {message === null ? null : (
        <p className={styles.error} role="alert">
          {message}
        </p>
      )}
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primary}
          disabled={saving}
          onClick={() => {
            void save();
          }}
        >
          {saving ? '저장 중…' : '저장'}
        </button>
        <button type="button" className={styles.secondary} disabled={saving} onClick={close}>
          취소
        </button>
      </div>
    </section>
  );
}

/**
 * 옷장 모달 (ROADMAP 12a, ARCHITECTURE 7장 추천 A): 피부색·머리색, 슬롯 7개(선택 슬롯은 "없음"), 아이템 채널별 색.
 * 편집 중 외형은 모달 안 로컬 상태, 저장은 PATCH /me 전체 교체. 미리보기 = 합성 시트 down/0 3x
 */
export function WardrobeModal() {
  const open = useUiStore((s) => s.wardrobeOpen);
  const me = useAuthStore((s) => s.me);
  const options = useAuthStore((s) => s.config?.avatarOptions);
  if (!open || me === null || options === undefined) {
    return null;
  }
  return (
    <div className={styles.backdrop}>
      <WardrobeForm initial={me.appearance} options={options} />
    </div>
  );
}
