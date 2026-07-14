import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

export type PopoverEventData = {
  id: string;
  kind: 'personal' | 'course' | 'university' | 'holiday' | 'task';
  title: string;
  start?: string;
  end?: string;
  allDay?: boolean;
  color?: string;
  // course
  room?: string;
  teacher?: string;
  // university
  univType?: string;
  // task
  courseName?: string;
  dueText?: string;
};

type Props = {
  event: PopoverEventData | null;
  anchorRect: DOMRect | null;
  anchorEl?: Element | null;
  onEdit?: (event: PopoverEventData) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
};

const UNIV_TYPE_LABEL: Record<string, string> = {
  exam: '試験期間',
  transfer: '振替授業',
  interval: '休業期間',
  holiday: '祝日',
  other: 'その他',
};

function formatDateTime(s: string | undefined): string {
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  const mm = d.getMonth() + 1;
  const dd = d.getDate();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  if (s.includes('T') && (hh !== '00' || min !== '00')) {
    return `${mm}月${dd}日 ${hh}:${min}`;
  }
  return `${mm}月${dd}日`;
}

export default function EventPopover({ event, anchorRect, anchorEl, onEdit, onDelete, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!event) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        // anchorEl 自身をクリックした場合は閉じない（handleEventClick 側でトグル処理する）
        if (anchorEl && anchorEl.contains(e.target as Node)) return;
        onClose();
      }
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    setTimeout(() => document.addEventListener('mousedown', handler), 0);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [event, onClose, anchorEl]);

  if (!event || !anchorRect) return null;

  // ポップオーバーの位置計算（画面端を考慮）
  const popoverWidth = 280;
  const margin = 8;
  let left = anchorRect.right + margin;
  if (left + popoverWidth > window.innerWidth - margin) {
    left = anchorRect.left - popoverWidth - margin;
  }
  if (left < margin) left = margin;
  let top = anchorRect.top;
  const popoverHeight = 200;
  if (top + popoverHeight > window.innerHeight - margin) {
    top = window.innerHeight - popoverHeight - margin;
  }
  if (top < margin) top = margin;

  const accentColor = event.color ?? '#4f46e5';

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        top,
        left,
        zIndex: 2000,
        width: popoverWidth,
        background: '#fff',
        borderRadius: '10px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        overflow: 'hidden',
      }}
    >
      {/* カラーバー */}
      <div style={{ height: '4px', background: accentColor }} />

      {/* ヘッダー */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        padding: '12px 14px 8px',
      }}>
        <div style={{
          fontSize: '15px', fontWeight: 'bold', color: '#111827',
          lineHeight: 1.3, flex: 1, marginRight: '8px', wordBreak: 'break-all',
        }}>
          {event.title}
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '18px', lineHeight: 1, flexShrink: 0 }}
        >
          ×
        </button>
      </div>

      {/* 詳細 */}
      <div style={{ padding: '0 14px 12px', fontSize: '13px', color: '#6b7280' }}>
        {/* 日時 */}
        {(event.start || event.end) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <span style={{ fontSize: '14px' }}>🕐</span>
            <span>
              {event.allDay
                ? `${formatDateTime(event.start)}${event.end && event.end !== event.start ? ` 〜 ${formatDateTime(event.end)}` : ''}`
                : `${formatDateTime(event.start)}${event.end ? ` 〜 ${formatDateTime(event.end)}` : ''}`
              }
            </span>
          </div>
        )}

        {/* 授業: 教室・教員 */}
        {event.kind === 'course' && (
          <>
            {event.room && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <span style={{ fontSize: '14px' }}>📍</span>
                <span>{event.room}</span>
              </div>
            )}
            {event.teacher && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '14px' }}>👤</span>
                <span>{event.teacher}</span>
              </div>
            )}
          </>
        )}

        {/* 大学イベント: 種別 */}
        {event.kind === 'university' && event.univType && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '14px' }}>🏫</span>
            <span>{UNIV_TYPE_LABEL[event.univType] ?? event.univType}</span>
          </div>
        )}

        {/* タスク: 期限・科目 */}
        {event.kind === 'task' && (
          <>
            {event.dueText && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <span style={{ fontSize: '14px' }}>⏰</span>
                <span>期限: {event.dueText}</span>
              </div>
            )}
            {event.courseName && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '14px' }}>📚</span>
                <span>{event.courseName}</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* タスクページへのリンク */}
      {event.kind === 'task' && (
        <div style={{ padding: '8px 14px 12px', borderTop: '1px solid #f3f4f6' }}>
          <button
            onClick={() => { onClose(); navigate('/tasks'); }}
            style={{
              width: '100%', padding: '6px', borderRadius: '6px',
              border: '1px solid #e5e7eb', background: '#fff',
              color: '#374151', fontSize: '13px', cursor: 'pointer',
            }}
          >
            タスクページで開く
          </button>
        </div>
      )}

      {/* 個人予定のアクションボタン */}
      {event.kind === 'personal' && (
        <div style={{
          display: 'flex', gap: '8px',
          padding: '8px 14px 12px',
          borderTop: '1px solid #f3f4f6',
        }}>
          {onEdit && (
            <button
              onClick={() => { onEdit(event); onClose(); }}
              style={{
                flex: 1, padding: '6px', borderRadius: '6px',
                border: '1px solid #e5e7eb', background: '#fff',
                color: '#374151', fontSize: '13px', cursor: 'pointer',
              }}
            >
              ✏️ 編集
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => { onDelete(event.id); onClose(); }}
              style={{
                flex: 1, padding: '6px', borderRadius: '6px',
                border: '1px solid #fee2e2', background: '#fff',
                color: '#dc2626', fontSize: '13px', cursor: 'pointer',
              }}
            >
              🗑️ 削除
            </button>
          )}
        </div>
      )}
    </div>
  );
}
