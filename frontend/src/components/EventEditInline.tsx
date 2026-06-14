import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { EVENT_COLORS, type EventFormData } from './EventModal';

const VISIBLE_COLORS = EVENT_COLORS.slice(0, 4);

type Props = {
  eventId: string;
  initialData: EventFormData;
  onAutoSave: (eventId: string, data: EventFormData) => Promise<void>;
  onDelete: (eventId: string) => Promise<void>;
  onClose: () => void;
};

export default function EventEditInline({ eventId, initialData, onAutoSave, onDelete, onClose }: Props) {
  const [title, setTitle] = useState(initialData.title);
  const [start, setStart] = useState(initialData.start);
  const [end, setEnd] = useState(initialData.end);
  const [allDay, setAllDay] = useState(initialData.allDay);
  const [color, setColor] = useState(initialData.color);
  const [deleteHover, setDeleteHover] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => titleRef.current?.focus(), 50);
  }, []);

  // 右にはみ出る場合はイベントの左側に反転して表示
  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.right > window.innerWidth - 8) {
      el.style.left = 'auto';
      el.style.right = 'calc(100% + 8px)';
    } else {
      el.style.left = 'calc(100% + 8px)';
      el.style.right = 'auto';
    }
  }, []);

  // 外クリックで閉じる
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    setTimeout(() => document.addEventListener('click', handler), 0);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('click', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [onClose]);

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  const scheduleAutoSave = useCallback((data: EventFormData) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onAutoSave(eventId, data).catch(() => {});
    }, 500);
  }, [eventId, onAutoSave]);

  return (
    <div
      ref={panelRef}
      onClick={e => e.stopPropagation()}
      style={{
        position: 'absolute',
        top: 0,
        left: 'calc(100% + 8px)',
        zIndex: 9999,
        width: 320,
        background: '#fff',
        borderRadius: '12px',
        boxShadow: '0 8px 40px rgba(0,0,0,0.22)',
        overflow: 'hidden',
      }}
    >
      <div style={{ height: '4px', background: color, transition: 'background 0.15s' }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 10px' }}>
        <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 'bold', color: '#111827' }}>予定を編集</h2>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#9ca3af', fontSize: '20px', lineHeight: 1 }}
        >
          ×
        </button>
      </div>

      <div style={{ padding: '0 16px 16px' }}>
        <div style={{ marginBottom: '14px' }}>
          <input
            ref={titleRef}
            type="text"
            value={title}
            onChange={e => {
              setTitle(e.target.value);
              scheduleAutoSave({ title: e.target.value, start, end, allDay, color });
            }}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onClose(); } }}
            placeholder="タイトルを追加"
            style={{
              width: '100%', fontSize: '15px', fontWeight: 'bold',
              border: 'none', borderBottom: `2px solid ${color}`,
              padding: '6px 0', outline: 'none', boxSizing: 'border-box', color: '#111827',
            }}
          />
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#374151' }}>
            <input
              type="checkbox"
              checked={allDay}
              onChange={e => {
                setAllDay(e.target.checked);
                scheduleAutoSave({ title, start, end, allDay: e.target.checked, color });
              }}
              style={{ width: '15px', height: '15px', accentColor: color }}
            />
            終日
          </label>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
          <div>
            <label style={labelStyle}>開始</label>
            <input
              type={allDay ? 'date' : 'datetime-local'}
              value={allDay ? start.split('T')[0] : start}
              onChange={e => {
                setStart(e.target.value);
                scheduleAutoSave({ title, start: e.target.value, end, allDay, color });
              }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onClose(); } }}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>終了</label>
            <input
              type={allDay ? 'date' : 'datetime-local'}
              value={allDay ? end.split('T')[0] : end}
              onChange={e => {
                setEnd(e.target.value);
                scheduleAutoSave({ title, start, end: e.target.value, allDay, color });
              }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onClose(); } }}
              style={inputStyle}
            />
          </div>
        </div>

        <div style={{ marginBottom: '18px' }}>
          <label style={{ ...labelStyle, marginBottom: '8px', display: 'block' }}>色</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {VISIBLE_COLORS.map(c => (
              <button
                key={c.value}
                type="button"
                onClick={() => {
                  setColor(c.value);
                  scheduleAutoSave({ title, start, end, allDay, color: c.value });
                }}
                style={{
                  width: '26px', height: '26px', borderRadius: '50%',
                  background: c.value,
                  border: color === c.value ? '3px solid #111827' : '3px solid transparent',
                  cursor: 'pointer',
                  outline: color === c.value ? '2px solid white' : 'none',
                  outlineOffset: '-4px',
                  transition: 'border-color 0.15s',
                }}
              />
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onDelete(eventId)}
          onMouseEnter={() => setDeleteHover(true)}
          onMouseLeave={() => setDeleteHover(false)}
          style={{
            width: '100%', padding: '7px 0', borderRadius: '6px',
            border: '1px solid #fca5a5',
            background: deleteHover ? '#fee2e2' : '#fff',
            color: '#dc2626', fontSize: '13px', cursor: 'pointer',
            transition: 'background 0.15s',
          }}
        >
          削除
        </button>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '11px', fontWeight: 'bold',
  color: '#9ca3af', marginBottom: '4px', textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '5px 8px',
  border: '1px solid #e5e7eb', borderRadius: '6px',
  fontSize: '13px', color: '#374151', boxSizing: 'border-box',
  outline: 'none',
};
