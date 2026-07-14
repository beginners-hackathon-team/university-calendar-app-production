import { useEffect, useState } from 'react';

/* ── 表示レイヤー定義 ─────────────────────────────── */

export type LayerKey = 'personal' | 'course' | 'task' | 'university' | 'holiday';

export const LAYERS: { key: LayerKey; label: string; color: string }[] = [
  { key: 'personal', label: '個人予定', color: '#4B82F5' },
  { key: 'course', label: '授業', color: '#93C5FD' },
  { key: 'task', label: '課題・タスク', color: '#A78BFA' },
  { key: 'university', label: '大学行事', color: '#7DD3FC' },
  { key: 'holiday', label: '祝日', color: '#FCA5A5' },
];

/* ── ミニカレンダー ─────────────────────────────── */

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function MiniCalendar({ viewDate, onSelectDate }: {
  viewDate: Date;
  onSelectDate: (date: Date) => void;
}) {
  const [cursor, setCursor] = useState(() => new Date(viewDate.getFullYear(), viewDate.getMonth(), 1));

  // メインカレンダーの移動に追従する
  useEffect(() => {
    setCursor(new Date(viewDate.getFullYear(), viewDate.getMonth(), 1));
  }, [viewDate]);

  const today = new Date();
  const gridStart = new Date(cursor);
  gridStart.setDate(1 - gridStart.getDay());

  const weeks: Date[][] = [];
  const d = new Date(gridStart);
  for (let w = 0; w < 6; w++) {
    const row: Date[] = [];
    for (let i = 0; i < 7; i++) {
      row.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    weeks.push(row);
  }

  const moveMonth = (delta: number) => {
    setCursor(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  return (
    <div>
      {/* 月ヘッダー */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, padding: '0 2px' }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--c-text-1)', letterSpacing: '-0.01em' }}>
          {cursor.getFullYear()}年{cursor.getMonth() + 1}月
        </span>
        <div style={{ display: 'flex', gap: 2 }}>
          {([{ label: '‹', delta: -1, aria: '前の月' }, { label: '›', delta: 1, aria: '次の月' }] as const).map(b => (
            <button
              key={b.aria}
              onClick={() => moveMonth(b.delta)}
              aria-label={b.aria}
              style={{
                width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: 'none', background: 'transparent', borderRadius: 6,
                cursor: 'pointer', color: 'var(--c-text-3)', fontSize: 14, lineHeight: 1,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#F0F2F5'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {/* 曜日 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 2 }}>
        {WEEKDAY_LABELS.map((w, i) => (
          <div
            key={w}
            style={{
              textAlign: 'center', fontSize: 9.5, fontWeight: 600, padding: '2px 0',
              color: i === 0 ? '#EF4444' : i === 6 ? '#3B82F6' : 'var(--c-text-3)',
            }}
          >
            {w}
          </div>
        ))}
      </div>

      {/* 日付グリッド */}
      {weeks.map((row, wi) => (
        <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {row.map(date => {
            const inMonth = date.getMonth() === cursor.getMonth();
            const isToday = isSameDay(date, today);
            const isViewDay = isSameDay(date, viewDate);
            return (
              <button
                key={date.toISOString()}
                onClick={() => onSelectDate(new Date(date))}
                style={{
                  height: 24, width: '100%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: 'none', background: 'transparent', cursor: 'pointer', padding: 0,
                }}
              >
                <span style={{
                  width: 20, height: 20, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10.5,
                  fontWeight: isToday || isViewDay ? 700 : 500,
                  background: isToday ? '#4B82F5' : isViewDay ? '#DBE7FD' : 'transparent',
                  color: isToday ? '#fff' : inMonth ? 'var(--c-text-2)' : '#C3CAD5',
                  transition: 'background 0.1s',
                }}
                  onMouseEnter={e => { if (!isToday) e.currentTarget.style.background = isViewDay ? '#DBE7FD' : '#F0F2F5'; }}
                  onMouseLeave={e => { if (!isToday) e.currentTarget.style.background = isViewDay ? '#DBE7FD' : 'transparent'; }}
                >
                  {date.getDate()}
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* ── サイドバー本体 ─────────────────────────────── */

type Props = {
  viewDate: Date;
  onSelectDate: (date: Date) => void;
  onCreate: (anchor: HTMLElement) => void;
  layers: Record<LayerKey, boolean>;
  onToggleLayer: (key: LayerKey) => void;
};

export default function CalendarSidebar({ viewDate, onSelectDate, onCreate, layers, onToggleLayer }: Props) {
  return (
    <div
      style={{
        width: 216, flexShrink: 0,
        borderRight: '1px solid var(--c-border)',
        background: '#FCFCFD',
        padding: '14px 14px 20px',
        overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: 18,
      }}
    >
      {/* 作成ボタン */}
      <button
        onClick={e => onCreate(e.currentTarget)}
        style={{
          display: 'flex', alignItems: 'center', gap: 9,
          padding: '10px 18px 10px 14px',
          alignSelf: 'flex-start',
          border: '1px solid var(--c-border)',
          borderRadius: 24,
          background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 3px 8px rgba(0,0,0,0.05)',
          cursor: 'pointer',
          fontSize: 13.5, fontWeight: 600, color: 'var(--c-text-1)',
          fontFamily: 'inherit',
          transition: 'box-shadow 0.15s, background 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.12), 0 5px 14px rgba(0,0,0,0.08)'; }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08), 0 3px 8px rgba(0,0,0,0.05)'; }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M8 2.5v11M2.5 8h11" stroke="#4B82F5" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        作成
      </button>

      {/* ミニカレンダー */}
      <MiniCalendar viewDate={viewDate} onSelectDate={onSelectDate} />

      {/* レイヤー切替 */}
      <div>
        <p style={{
          margin: '0 0 8px', fontSize: 10, fontWeight: 700, color: 'var(--c-text-3)',
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          マイカレンダー
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {LAYERS.map(layer => (
            <label
              key={layer.key}
              style={{
                display: 'flex', alignItems: 'center', gap: 9,
                padding: '5px 6px', borderRadius: 7, cursor: 'pointer',
                fontSize: 12.5, color: 'var(--c-text-2)', fontWeight: 500,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#F0F2F5'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <input
                type="checkbox"
                checked={layers[layer.key]}
                onChange={() => onToggleLayer(layer.key)}
                style={{ width: 14, height: 14, accentColor: layer.color, cursor: 'pointer' }}
              />
              {layer.label}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
