import type { ReactNode } from 'react';

export function TinyPill({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  return (
    <span
      className="text-[11px] font-bold"
      style={{
        color: muted ? 'var(--c-text-2)' : 'var(--c-accent)',
        background: muted ? '#F8FAFC' : 'var(--c-accent-bg)',
        border: '1px solid var(--c-border)',
        borderRadius: 999,
        padding: '2px 7px',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

export function CompactButton({ children, disabled, onClick }: { children: ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="text-[12px] font-semibold"
      style={{
        padding: '5px 9px',
        borderRadius: 8,
        border: '1px solid var(--c-border)',
        background: '#fff',
        color: 'var(--c-text-2)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}

export function TextDangerButton({ children, disabled, onClick }: { children: ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="text-[12px] font-semibold"
      style={{
        border: 'none',
        background: 'transparent',
        color: 'var(--c-danger)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        padding: '5px 2px',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}

export function ColumnShell({
  children,
  setNodeRef,
  style,
  highlighted,
}: {
  children: ReactNode;
  setNodeRef?: (node: HTMLElement | null) => void;
  style?: React.CSSProperties;
  highlighted?: boolean;
}) {
  return (
    <section
      ref={setNodeRef as (node: HTMLElement | null) => void}
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: '#fff',
        border: highlighted ? '1px solid var(--c-accent)' : '1px solid var(--c-border)',
        borderRadius: 'var(--r-card)',
        overflow: 'hidden',
        minWidth: 0,
        boxShadow: highlighted ? '0 0 0 2px var(--c-accent-bg)' : '0 1px 2px rgba(0,0,0,0.025)',
        transition: 'border-color 0.12s, box-shadow 0.12s',
        ...style,
      }}
    >
      {children}
    </section>
  );
}

export function ColumnHeader({
  title,
  count,
  gripProps,
  gripRef,
  right,
}: {
  title: string;
  count: number;
  gripProps?: Record<string, unknown>;
  gripRef?: (node: HTMLElement | null) => void;
  right?: ReactNode;
}) {
  return (
    <div
      className="flex items-center justify-between gap-3"
      style={{
        padding: '11px 14px',
        borderBottom: '1px solid var(--c-border)',
        background: '#FAFBFC',
      }}
    >
      <div className="flex items-center gap-2" style={{ minWidth: 0 }}>
        <span
          ref={gripRef as (node: HTMLElement | null) => void}
          {...gripProps}
          aria-label="ドラッグして並び替え"
          title="ドラッグして並び替え"
          style={{
            cursor: 'grab',
            color: 'var(--c-text-3)',
            fontSize: 15,
            lineHeight: 1,
            touchAction: 'none',
            userSelect: 'none',
          }}
        >
          ⠿
        </span>
        <h2 className="text-[14px] font-bold" style={{ color: 'var(--c-text-1)', whiteSpace: 'nowrap' }}>{title}</h2>
        <span className="text-[12px] font-semibold" style={{ color: 'var(--c-text-3)' }}>{count}</span>
      </div>
      {right}
    </div>
  );
}

// TODOカラムのブロック（課題/Todo共通、テキストモード・リストモードでも共通）。
// VSCode を参考に、境界線・ホバーハイライトは一切使わない。背景が出るのは
// 「選択中（カーソルがある = 現在行ハイライト）」と「ドラッグ中」だけ。
// リストモードは常時その背景を出し、角丸をわずかにつけて「少しだけ強調したブロック」に
// 留める（カードUIまでは寄せない）。
export type TextRowKind = 'assignment' | 'todo';

const TEXT_ROW_BG_ACTIVE: Record<TextRowKind, string> = {
  todo: '#F1F2F4',
  assignment: '#E9EDF7',
};

export function getTextRowStyle(
  kind: TextRowKind,
  opts: { selected: boolean; isDragging?: boolean; variant: 'text' | 'list' },
): React.CSSProperties {
  const { selected, isDragging, variant } = opts;
  const showBg = variant === 'list' || selected || Boolean(isDragging);
  return {
    borderRadius: variant === 'list' ? 5 : 0,
    background: showBg ? TEXT_ROW_BG_ACTIVE[kind] : 'transparent',
    // ドラッグ中の「浮き上がり」はシャドウだけで表現する（ツールチップ等の付加表示はしない）。
    boxShadow: isDragging ? '0 6px 16px rgba(0,0,0,0.12)' : 'none',
    transition: 'background 0.12s, box-shadow 0.12s',
  };
}

export function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4" style={{ color: 'var(--c-text-3)' }}>
      <div
        className="mb-3"
        style={{ width: 32, height: 32, borderRadius: '50%', background: '#ECEEF2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M8 3.5v5M8 10.5v1" stroke="#9AA5B4" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <p className="text-[13px] text-center">{label}</p>
    </div>
  );
}
