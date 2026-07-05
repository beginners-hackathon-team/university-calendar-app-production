import type FullCalendar from '@fullcalendar/react';

/* ── Icons ─────────────────────────────────────── */

function ChevronLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M9 2.5L4.5 7L9 11.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M5 2.5L9.5 7L5 11.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Custom Toolbar ─────────────────────────────── */

const VIEW_OPTIONS = [
  { key: 'dayGridMonth', label: '月' },
  { key: 'timeGridWeek', label: '週' },
  { key: 'timeGridDay', label: '日' },
] as const;

export function CalendarToolbar({
  calendarRef,
  title,
  view,
  onViewChange,
}: {
  calendarRef: React.RefObject<FullCalendar | null>;
  title: string;
  view: string;
  onViewChange: (v: string) => void;
}) {
  const api = () => calendarRef.current?.getApi();

  const switchView = (v: string) => {
    api()?.changeView(v);
    onViewChange(v);
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        height: 54,
        flexShrink: 0,
        background: '#fff',
        borderBottom: '1px solid var(--c-border)',
        position: 'relative',
      }}
    >
      {/* Left: prev / next / today */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {([
          { label: '前', icon: <ChevronLeft />, action: () => api()?.prev(), ariaLabel: '前へ' },
          { label: '次', icon: <ChevronRight />, action: () => api()?.next(), ariaLabel: '次へ' },
        ] as const).map(btn => (
          <button
            key={btn.ariaLabel}
            onClick={btn.action}
            aria-label={btn.ariaLabel}
            style={{
              width: 30, height: 30,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 8,
              border: '1px solid var(--c-border)',
              background: '#fff',
              cursor: 'pointer',
              color: 'var(--c-text-2)',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--c-bg)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#fff'; }}
          >
            {btn.icon}
          </button>
        ))}
        <button
          onClick={() => api()?.today()}
          style={{
            height: 30,
            padding: '0 13px',
            marginLeft: 4,
            borderRadius: 8,
            border: '1px solid var(--c-border)',
            background: '#fff',
            cursor: 'pointer',
            fontSize: 12.5,
            fontWeight: 600,
            color: 'var(--c-text-2)',
            letterSpacing: '-0.01em',
            fontFamily: 'inherit',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--c-bg)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#fff'; }}
        >
          今日
        </button>
      </div>

      {/* Center: title (absolute to not affect flex layout) */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 16,
          fontWeight: 700,
          color: 'var(--c-text-1)',
          letterSpacing: '-0.022em',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
        }}
      >
        {title}
      </div>

      {/* Right: view switcher — segmented control */}
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 2, padding: 3, background: '#ECEEF2', borderRadius: 10 }}>
        {VIEW_OPTIONS.map(v => (
          <button
            key={v.key}
            onClick={() => switchView(v.key)}
            style={{
              padding: '5px 14px',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              fontSize: 12.5,
              fontWeight: 600,
              fontFamily: 'inherit',
              letterSpacing: '-0.01em',
              background: view === v.key ? '#fff' : 'transparent',
              color: view === v.key ? 'var(--c-text-1)' : 'var(--c-text-3)',
              boxShadow: view === v.key ? '0 1px 3px rgba(0,0,0,0.09)' : 'none',
              transition: 'background 0.12s, color 0.12s, box-shadow 0.12s',
            }}
          >
            {v.label}
          </button>
        ))}
      </div>
    </div>
  );
}
