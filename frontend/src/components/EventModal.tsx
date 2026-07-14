import { useState, useEffect, useRef } from 'react';

export const EVENT_COLORS = [
  { value: '#4f46e5', label: '藍' },
  { value: '#dc2626', label: '赤' },
  { value: '#16a34a', label: '緑' },
  { value: '#d97706', label: '橙' },
  { value: '#7c3aed', label: '紫' },
  { value: '#0891b2', label: '青' },
  { value: '#db2777', label: '桃' },
  { value: '#4b5563', label: '灰' },
];

const VISIBLE_COLORS = EVENT_COLORS.slice(0, 4);

export type EventFormData = {
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  color: string;
  location?: string;
  description?: string;
};

type Props = {
  open: boolean;
  initialData: Partial<EventFormData>;
  onSave: (data: EventFormData) => Promise<void>;
  onClose: () => void;
};

export default function EventModal({ open, initialData, onSave, onClose }: Props) {
  const [title, setTitle] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [color, setColor] = useState<string>(EVENT_COLORS[0]?.value ?? '#4f46e5');
  const [saving, setSaving] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTitle(initialData.title ?? '');
      setStart(initialData.start ?? '');
      setEnd(initialData.end ?? '');
      setAllDay(initialData.allDay ?? false);
      setColor(initialData.color ?? EVENT_COLORS[0]?.value ?? '#4f46e5');
      setTimeout(() => titleRef.current?.focus(), 50);
    }
  }, [open, initialData]);

  useEffect(() => {
    if (!open) return;
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', keyHandler);
    return () => document.removeEventListener('keydown', keyHandler);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave({ title: title.trim(), start, end, allDay, color });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div style={{
        background: '#fff',
        borderRadius: '12px',
        boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
        width: 340,
        maxWidth: '95vw',
        overflow: 'hidden',
      }}>
        <div style={{ height: '4px', background: color, transition: 'background 0.15s' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 10px' }}>
          <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 'bold', color: '#111827' }}>予定を作成</h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#9ca3af', fontSize: '20px', lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '0 16px 16px' }}>
          <div style={{ marginBottom: '14px' }}>
            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="タイトルを追加"
              required
              style={{
                width: '100%', fontSize: '15px', fontWeight: 'bold',
                border: 'none', borderBottom: `2px solid ${color}`,
                padding: '6px 0', outline: 'none', boxSizing: 'border-box',
                color: '#111827', transition: 'border-color 0.15s',
              }}
            />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#374151' }}>
              <input
                type="checkbox"
                checked={allDay}
                onChange={e => setAllDay(e.target.checked)}
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
                onChange={e => setStart(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>終了</label>
              <input
                type={allDay ? 'date' : 'datetime-local'}
                value={allDay ? end.split('T')[0] : end}
                onChange={e => setEnd(e.target.value)}
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
                  onClick={() => setColor(c.value)}
                  title={c.label}
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

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '7px 14px', borderRadius: '6px',
                border: '1px solid #e5e7eb', background: '#fff',
                color: '#374151', fontSize: '13px', cursor: 'pointer',
              }}
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim()}
              style={{
                padding: '7px 18px', borderRadius: '6px',
                border: 'none', background: color,
                color: '#fff', fontSize: '13px', fontWeight: 'bold',
                cursor: saving ? 'wait' : 'pointer',
                opacity: saving || !title.trim() ? 0.6 : 1,
                transition: 'background 0.15s',
              }}
            >
              {saving ? '保存中...' : '作成'}
            </button>
          </div>
        </form>
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
