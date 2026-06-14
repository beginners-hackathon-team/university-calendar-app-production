import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import jaLocale from '@fullcalendar/core/locales/ja';
import type { DateSelectArg, EventClickArg } from '@fullcalendar/core/index.js';
import type { DateClickArg } from '@fullcalendar/interaction';
import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { fetchCalendar } from '../api/calendar';
import { periodToTime } from '../periodToTime';
import { fetchUniversityEvents } from '../api/universityEvents';
import { fetchPersonalEvents, createPersonalEvent, updatePersonalEvent, deletePersonalEvent } from '../api/personalEvents';
import { type EventFormData } from '../components/EventModal';
import EventPopover, { type PopoverEventData } from '../components/EventPopover';
import EventEditPopover from '../components/EventEditPopover';
import EventCreatePopover from '../components/EventCreatePopover';

type EventType = {
  title: string;
  start: Date | string;
  color?: string;
  id?: string;
  className?: string;
  allDay?: boolean;
  editable?: boolean;
  display?: string;
  textColor?: string;
  end?: string;
  extendedProps?: Record<string, unknown>;
}

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

function CalendarToolbar({
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

/* ── FullCalendar CSS overrides ─────────────────── */

const FC_STYLES = `
  /* Core */
  .fc {
    --fc-border-color: #E8EBF0;
    --fc-today-bg-color: rgba(75,130,245,0.038);
    --fc-now-indicator-color: #4B82F5;
    --fc-page-bg-color: #FFFFFF;
    --fc-neutral-bg-color: #FAFBFC;
    --fc-highlight-color: rgba(75,130,245,0.09);
    font-family: "Noto Sans JP", -apple-system, "Hiragino Sans", "Hiragino Kaku Gothic ProN", sans-serif;
    background: #fff;
    height: 100%;
    -webkit-font-smoothing: antialiased;
  }

  /* Slim custom scrollbar */
  .fc .fc-scroller::-webkit-scrollbar { width: 4px; height: 4px; }
  .fc .fc-scroller::-webkit-scrollbar-track { background: transparent; }
  .fc .fc-scroller::-webkit-scrollbar-thumb { background: #D0D7E2; border-radius: 4px; }

  /* Kill default toolbar — using custom */
  .fc .fc-toolbar { display: none !important; }

  /* ── Column headers ── */
  .fc .fc-col-header { background: #FAFBFC; }
  .fc .fc-col-header-cell { padding: 9px 0 !important; }
  .fc .fc-col-header-cell-cushion {
    font-size: 11.5px !important;
    font-weight: 600 !important;
    color: #64748B;
    text-decoration: none !important;
    padding: 0 !important;
    letter-spacing: 0.01em;
  }

  /* ── Sat / Sun / holiday coloring ── */
  .fc-day-sat .fc-col-header-cell-cushion,
  .fc-day-sat .fc-daygrid-day-number { color: #3B82F6 !important; }
  .fc-day-sun .fc-col-header-cell-cushion,
  .fc-day-sun .fc-daygrid-day-number,
  .is-holiday-column .fc-col-header-cell-cushion,
  .is-holiday-column .fc-daygrid-day-number { color: #EF4444 !important; }

  /* Today header text */
  .fc-day-today .fc-col-header-cell-cushion { color: #4B82F5 !important; }

  /* ── Time grid ── */
  .fc .fc-timegrid-slot { height: 28px; }
  .fc .fc-timegrid-slot-minor { border-top-color: #F1F4F8 !important; }
  .fc .fc-timegrid-slot-label-cushion {
    font-size: 10.5px;
    color: #B0B9C6;
    font-weight: 500;
    padding-right: 10px !important;
  }
  .fc .fc-timegrid-col { border-color: #E8EBF0 !important; }
  .fc .fc-timegrid-axis { border-color: #E8EBF0 !important; }

  /* ── Now indicator ── */
  .fc .fc-timegrid-now-indicator-line {
    border-color: #4B82F5 !important;
    border-width: 1.5px !important;
  }
  .fc .fc-timegrid-now-indicator-arrow {
    border-top-color: transparent !important;
    border-bottom-color: transparent !important;
    border-left-color: #4B82F5 !important;
    margin-top: -4px;
  }

  /* ── Today highlight ── */
  .fc-day-today { background-color: rgba(75,130,245,0.038) !important; }

  /* ── Day numbers (month view) ── */
  .fc .fc-daygrid-day-number {
    font-size: 12.5px;
    font-weight: 500;
    color: #4A5568;
    padding: 5px 8px !important;
    text-decoration: none !important;
  }
  /* Blue circle for today */
  .fc-day-today .fc-daygrid-day-number {
    display: inline-flex !important;
    align-items: center;
    justify-content: center;
    width: 26px; height: 26px;
    background: #4B82F5;
    border-radius: 50%;
    color: #fff !important;
    font-size: 12px;
    font-weight: 700;
    padding: 0 !important;
    margin: 4px;
    line-height: 1;
  }

  /* ── Events ── */
  .fc-event {
    cursor: pointer;
    border: none !important;
    border-radius: 6px !important;
    box-shadow: none !important;
    transition: filter 0.1s ease, transform 0.1s ease;
  }
  .fc-event:hover { filter: brightness(0.93); transform: translateY(-0.5px); }
  .fc .fc-event-main { padding: 0; height: 100%; }

  /* Course events: left-border accent */
  .is-course { border-radius: 7px !important; overflow: hidden; }
  .is-course .fc-event-main {
    border-left: 2.5px solid rgba(30,58,138,0.28) !important;
  }
  .is-course .fc-event-main-frame { padding: 2px 5px; display: flex; flex-direction: column; height: 100%; }
  .is-course .fc-event-time { font-size: 9.5px; font-weight: 600; opacity: 0.68; line-height: 1.4; }
  .is-course .fc-event-title { font-size: 11.5px; font-weight: 700; line-height: 1.35; }
  .is-course .fc-event-title-container { flex: 1; overflow: hidden; }

  /* Personal events */
  .is-personal .fc-event-main { padding: 0; }

  /* All-day chips */
  .is-holiday, .is-univ-event {
    border: none !important;
    border-radius: 5px !important;
    font-size: 11px !important;
    font-weight: 600 !important;
  }
  .is-holiday .fc-event-main,
  .is-univ-event .fc-event-main {
    padding: 1px 6px !important;
  }

  /* Selection highlight */
  .fc-highlight { background: rgba(75,130,245,0.08) !important; border-radius: 6px !important; }

  /* Month view "more" link */
  .fc .fc-daygrid-more-link { font-size: 11px; font-weight: 600; color: #4B82F5; }

  /* Popover (month view overflow) */
  .fc .fc-popover {
    border-radius: 13px !important;
    border: 1px solid #E8EBF0 !important;
    box-shadow: 0 8px 28px rgba(0,0,0,0.10) !important;
    overflow: hidden;
  }
  .fc .fc-popover-header {
    background: #FAFBFC !important;
    font-size: 12px; font-weight: 600;
    padding: 10px 14px !important;
    border-bottom: 1px solid #E8EBF0;
    color: #4A5568;
  }
  .fc .fc-popover-close { color: #9AA5B4; opacity: 1; }
  .fc .fc-popover-body { padding: 8px !important; }

  /* Not-allowed cursor */
  .fc-not-allowed, .fc-not-allowed * { cursor: default !important; }

  /* Daygrid borders */
  .fc .fc-daygrid-day { border-color: #E8EBF0 !important; }
`;

/* ── Main component ─────────────────────────────── */

export default function CalendarPage() {
  const [events, setEvents] = useState<EventType[]>([]);
  const [viewYearMonth, setViewYearMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [viewDateRange, setViewDateRange] = useState<{ start: Date; end: Date } | null>(null);
  const [showAllDaySlot, setShowAllDaySlot] = useState(false);

  // Custom toolbar state
  const [calendarTitle, setCalendarTitle] = useState('');
  const [currentView, setCurrentView] = useState('timeGridWeek');

  // 新規作成ポップアップ
  const [modalOpen, setModalOpen] = useState(false);
  const [modalInitial, setModalInitial] = useState<Partial<EventFormData>>({});
  const [createReferenceEl, setCreateReferenceEl] = useState<HTMLElement | null>(null);

  // 個人予定インライン編集
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [referenceEl, setReferenceEl] = useState<HTMLElement | null>(null);
  const [selectedEventData, setSelectedEventData] = useState<EventFormData | null>(null);

  // 授業・大学イベント・祝日の読み取り専用ポップオーバー
  const [popoverEvent, setPopoverEvent] = useState<PopoverEventData | null>(null);
  const [popoverAnchor, setPopoverAnchor] = useState<DOMRect | null>(null);
  const [popoverAnchorEl, setPopoverAnchorEl] = useState<Element | null>(null);
  // 現在表示中のポップオーバー対象イベントIDをrefで追跡（レンダーサイクルに依存しない）
  const popoverEventIdRef = useRef<string | null>(null);

  const calendarRef = useRef<FullCalendar>(null);
  const lastDateClickRef = useRef<number>(0);
  const isProgrammaticSelect = useRef(false);
  const prevViewTypeRef = useRef<string>('');
  const scrollTopRef = useRef<number>(0);
  const modalOpenRef = useRef(false);

  const getLocalDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = ('0' + (date.getMonth() + 1)).slice(-2);
    const day = ('0' + date.getDate()).slice(-2);
    return `${year}-${month}-${day}`;
  };

  const getUnivEventStyle = (type: string) => {
    switch (type) {
      case 'exam':     return { color: '#fef3c7', textColor: '#b45309' };
      case 'transfer': return { color: '#fee2e2', textColor: '#b91c1c' };
      case 'interval': return { color: '#f0fdf4', textColor: '#15803d' };
      default:         return { color: '#e0f2fe', textColor: '#0369a1' };
    }
  };

  const closePopover = useCallback(() => {
    setPopoverEvent(null);
    setPopoverAnchorEl(null);
    popoverEventIdRef.current = null;
  }, []);

  useEffect(() => { modalOpenRef.current = modalOpen; }, [modalOpen]);

  // 外部イベント（祝日・大学行事・個人予定）の取得
  useEffect(() => {
    const fetchAllExternalEvents = async () => {
      let holidayEvents: EventType[] = [];
      try {
        const holidayRes = await fetch('https://holidays-jp.github.io/api/v1/date.json');
        const holidayData = await holidayRes.json();
        holidayEvents = Object.keys(holidayData).map(date => ({
          title: holidayData[date],
          start: date,
          allDay: true,
          editable: false,
          display: 'block',
          color: '#ffcccc',
          textColor: '#B91C1C',
          className: 'is-holiday',
          id: `holiday-${date}`,
          extendedProps: { kind: 'holiday', holidayName: holidayData[date] },
        }));
      } catch {
        console.warn('祝日データの取得に失敗しました');
      }

      const univRaw = await fetchUniversityEvents(viewYearMonth.year);
      const univEvents: EventType[] = univRaw.map((item, index) => {
        const month = Number(item.date.split('-')[0]);
        const year = month <= 3 ? viewYearMonth.year + 1 : viewYearMonth.year;
        const displayTitle = item.type === 'transfer' && item.original_day
          ? `${item.name}(${item.original_day}曜授業)`
          : item.name;
        const style = getUnivEventStyle(item.type);
        return {
          title: displayTitle,
          start: `${year}-${item.date}`,
          allDay: true, editable: false, display: 'block',
          color: style.color, textColor: style.textColor,
          className: 'is-univ-event',
          id: `univ-${index}`,
          extendedProps: { kind: 'university', univType: item.type, univName: item.name },
        };
      });

      const personalRaw = await fetchPersonalEvents();
      const personalEvents: EventType[] = personalRaw.map(e => ({
        id: `personal-${e.id}`,
        title: e.title,
        start: e.start,
        end: e.end ?? undefined,
        allDay: e.all_day,
        color: e.color ?? '#4B82F5',
        className: 'is-personal',
        extendedProps: {
          kind: 'personal',
          rawId: e.id,
          color: e.color ?? '#4B82F5',
          allDay: e.all_day,
        },
      }));

      setEvents(prev => {
        const systemOnly = prev.filter(e =>
          !e.id?.startsWith('holiday-') && !e.id?.startsWith('univ-') && !e.id?.startsWith('personal-')
        );
        return [...systemOnly, ...holidayEvents, ...univEvents, ...personalEvents];
      });
    };

    fetchAllExternalEvents();
  }, []);

  // 授業イベントの取得
  useEffect(() => {
    fetchCalendar(viewYearMonth.year, viewYearMonth.month)
      .then((courses) => {
        const courseEvents = courses.flatMap((course) => {
          const time = periodToTime.find((p) => p.period === course.period);
          if (!time) return [];
          return course.dates.map((date) => ({
            id: `course-${course.id}-${date}`,
            title: course.name,
            start: `${date}T${time.start}:00`,
            end: `${date}T${time.end}:00`,
            className: 'is-course',
            color: '#DBEAFE',
            textColor: '#1E3A8A',
            editable: false,
            extendedProps: {
              kind: 'course',
              room: course.room,
              teacher: course.teacher,
              period: course.period,
            },
          }));
        });

        setEvents((prev) => {
          const withoutCourses = prev.filter(e => !e.id?.startsWith('course-'));
          return [...withoutCourses, ...courseEvents];
        });
      })
      .catch((err) => console.error('calendar取得失敗', err));
  }, [viewYearMonth]);

  // 終日予定の有無で allDaySlot を切り替える
  useEffect(() => {
    if (!viewDateRange) return;
    const has = events.some(e => {
      if (!e.allDay) return false;
      const s = new Date(typeof e.start === 'string' ? e.start : e.start);
      return s >= viewDateRange.start && s < viewDateRange.end;
    });
    setShowAllDaySlot(has);
  }, [events, viewDateRange]);

  const toDatetimeLocal = (dateStr: string) => dateStr.slice(0, 16);

  const closeEditPopover = useCallback(() => {
    setSelectedEventId(null);
    setReferenceEl(null);
    setSelectedEventData(null);
  }, []);

  const handleDateSelect = useCallback((selectInfo: DateSelectArg) => {
    if (isProgrammaticSelect.current) {
      isProgrammaticSelect.current = false;
      return;
    }
    // 作成フォームが開いている場合、カレンダークリックによる再選択は無視する
    // (click イベントで外クリックハンドラが閉じてくれる)
    if (modalOpenRef.current) {
      calendarRef.current?.getApi().unselect();
      return;
    }
    if (selectInfo.allDay) {
      const durationMs = new Date(selectInfo.endStr).getTime() - new Date(selectInfo.startStr).getTime();
      if (durationMs <= 24 * 60 * 60 * 1000) {
        calendarRef.current?.getApi().unselect();
        return;
      }
    }

    setPopoverEvent(null);
    closeEditPopover();

    const isAllDay = selectInfo.allDay;
    let startStr: string;
    let endStr: string;

    if (isAllDay) {
      startStr = selectInfo.startStr.split('T')[0] ?? selectInfo.startStr;
      const endDate = new Date(selectInfo.endStr);
      endDate.setDate(endDate.getDate() - 1);
      endStr = getLocalDateString(endDate);
    } else {
      startStr = toDatetimeLocal(selectInfo.startStr);
      endStr = toDatetimeLocal(selectInfo.endStr);
    }

    const anchor = (selectInfo.jsEvent?.target as HTMLElement | null)
      ?? document.querySelector<HTMLElement>('.fc-highlight');
    setCreateReferenceEl(anchor);
    setModalInitial({ title: '', start: startStr, end: endStr, allDay: isAllDay, color: '#4B82F5' });
    setModalOpen(true);
  }, [closeEditPopover]);

  // 8時にスクロール（初回マウント時のみ）
  useEffect(() => {
    calendarRef.current?.getApi().scrollToTime('08:00:00');
  }, []);

  // スクロール位置を ref に記録し続ける
  useEffect(() => {
    const attach = () => {
      const el = document.querySelector<HTMLElement>('.fc-scroller-liquid-absolute');
      if (!el) { setTimeout(attach, 50); return; }
      const handler = () => { scrollTopRef.current = el.scrollTop; };
      el.addEventListener('scroll', handler, { passive: true });
      scrollTopRef.current = el.scrollTop;
      return () => el.removeEventListener('scroll', handler);
    };
    const cleanup = attach();
    return () => { cleanup?.(); };
  }, []);

  // FullCalendar がスクロールをリセットするのを防ぐ
  useLayoutEffect(() => {
    const el = document.querySelector<HTMLElement>('.fc-scroller-liquid-absolute');
    if (el && Math.round(el.scrollTop) !== Math.round(scrollTopRef.current)) {
      el.scrollTop = scrollTopRef.current;
    }
  });

  const handleDateClick = useCallback((info: DateClickArg) => {
    if (info.allDay) return;
    const now = Date.now();
    const isDouble = now - lastDateClickRef.current < 400;
    lastDateClickRef.current = now;
    if (!isDouble) return;

    const start = new Date(info.date);
    start.setMinutes(0, 0, 0);
    const end = new Date(start);
    end.setHours(end.getHours() + 1);

    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:00`;

    isProgrammaticSelect.current = true;
    calendarRef.current?.getApi().select(start, end);

    setTimeout(() => {
      const anchor = (info.jsEvent?.target as HTMLElement | null)
        ?? document.querySelector<HTMLElement>('.fc-highlight');
      setPopoverEvent(null);
      closeEditPopover();
      setCreateReferenceEl(anchor);
      setModalInitial({ title: '', start: fmt(start), end: fmt(end), allDay: false, color: '#4B82F5' });
      setModalOpen(true);
    }, 0);
  }, [closeEditPopover]);

  const handleEventClick = useCallback((clickInfo: EventClickArg) => {
    clickInfo.jsEvent.stopPropagation();
    const evt = clickInfo.event;
    const props = evt.extendedProps as Record<string, unknown>;
    const kind = (props.kind as string) ?? 'personal';

    if (kind === 'personal') {
      if (selectedEventId === evt.id) {
        closeEditPopover();
        return;
      }
      const isAllDay = evt.allDay;
      const startStr = evt.startStr ?? '';
      const endStr = evt.endStr ?? '';
      const endForEdit = isAllDay
        ? (endStr
            ? new Date(new Date(endStr).getTime() - 86400000).toISOString().slice(0, 10)
            : startStr.slice(0, 10))
        : toDatetimeLocal(endStr || startStr);

      setSelectedEventId(evt.id);
      setReferenceEl(clickInfo.el as HTMLElement);
      setSelectedEventData({
        title: evt.title,
        start: isAllDay ? startStr.slice(0, 10) : toDatetimeLocal(startStr),
        end: endForEdit,
        allDay: isAllDay,
        color: (props.color as string) ?? '#4B82F5',
      });
      setPopoverEvent(null);
      setModalOpen(false);
      return;
    }

    // 同じイベントを再クリック → トグルで閉じる
    if (popoverEventIdRef.current === evt.id) {
      closePopover();
      return;
    }

    closeEditPopover();
    setModalOpen(false);
    const rect = clickInfo.el.getBoundingClientRect();
    const startStr = evt.startStr ?? '';
    const endStr = evt.endStr ?? '';
    setPopoverAnchor(rect);
    setPopoverAnchorEl(clickInfo.el);
    popoverEventIdRef.current = evt.id;

    if (kind === 'course') {
      setPopoverEvent({
        id: evt.id, kind: 'course', title: evt.title,
        start: startStr, end: endStr, allDay: false,
        color: '#DBEAFE', room: props.room as string, teacher: props.teacher as string,
      });
    } else if (kind === 'university') {
      setPopoverEvent({
        id: evt.id, kind: 'university',
        title: (props.univName as string) ?? evt.title,
        start: startStr, allDay: true,
        color: '#e0f2fe', univType: props.univType as string,
      });
    } else if (kind === 'holiday') {
      setPopoverEvent({
        id: evt.id, kind: 'holiday', title: evt.title,
        start: startStr, allDay: true, color: '#ffcccc',
      });
    }
  }, [selectedEventId, closeEditPopover, closePopover]);

  const handleModalSave = async (data: EventFormData) => {
    const payload = {
      title: data.title,
      start: (data.allDay ? data.start.split('T')[0] : data.start) ?? '',
      end: data.end ? (data.allDay ? (data.end.split('T')[0] ?? data.end) : data.end) : null,
      all_day: data.allDay,
      color: data.color ?? null,
    };
    const saved = await createPersonalEvent(payload);
    setEvents(prev => [...prev, {
      id: `personal-${saved.id}`,
      title: saved.title,
      start: saved.start,
      end: saved.end ?? undefined,
      allDay: saved.all_day,
      color: saved.color ?? '#4B82F5',
      className: 'is-personal',
      extendedProps: {
        kind: 'personal',
        rawId: saved.id,
        color: saved.color ?? '#4B82F5',
        allDay: saved.all_day,
      },
    }]);
    setModalOpen(false);
    calendarRef.current?.getApi().unselect();
  };

  const handleAutoSaveInline = useCallback(async (rawId: string, data: EventFormData) => {
    const payload = {
      title: data.title,
      start: (data.allDay ? data.start.split('T')[0] : data.start) ?? '',
      end: data.end ? (data.allDay ? (data.end.split('T')[0] ?? data.end) : data.end) : null,
      all_day: data.allDay,
      color: data.color ?? null,
    };
    const saved = await updatePersonalEvent(rawId, payload);
    setEvents(prev => prev.map(e =>
      e.id === `personal-${rawId}`
        ? {
            ...e,
            title: saved.title,
            start: saved.start,
            end: saved.end ?? undefined,
            allDay: saved.all_day,
            color: saved.color ?? '#4B82F5',
            extendedProps: { ...e.extendedProps, color: saved.color ?? '#4B82F5', allDay: saved.all_day },
          }
        : e
    ));
  }, []);

  const handleDeleteInline = useCallback(async (rawId: string) => {
    await deletePersonalEvent(rawId);
    setEvents(prev => prev.filter(e => e.id !== `personal-${rawId}`));
    closeEditPopover();
    calendarRef.current?.getApi().unselect();
  }, [closeEditPopover]);

  const applyEventChange = useCallback(async (info: {
    event: { id: string; title: string; startStr: string; endStr: string; allDay: boolean; extendedProps: Record<string, unknown> };
    revert: () => void;
  }) => {
    if (!info.event.id.startsWith('personal-')) { info.revert(); return; }
    const rawId = info.event.id.replace('personal-', '');
    const isAllDay = info.event.allDay;
    try {
      const saved = await updatePersonalEvent(rawId, {
        title: info.event.title,
        start: isAllDay ? info.event.startStr.slice(0, 10) : toDatetimeLocal(info.event.startStr),
        end: info.event.endStr ? (isAllDay ? info.event.endStr.slice(0, 10) : toDatetimeLocal(info.event.endStr)) : null,
        all_day: isAllDay,
        color: (info.event.extendedProps.color as string) ?? '#4B82F5',
      });
      setEvents(prev => prev.map(e =>
        e.id === info.event.id
          ? { ...e, start: saved.start, end: saved.end ?? undefined, allDay: saved.all_day }
          : e
      ));
    } catch {
      info.revert();
    }
  }, []);

  // Filtered events (hide course events on holidays)
  const filteredEvents = (() => {
    const holidayDates = new Set(
      events
        .filter(e => e.className === 'is-holiday')
        .map(e => (typeof e.start === 'string' ? e.start.split('T')[0] : ''))
    );
    return events.filter(e => {
      if (e.className !== 'is-course') return true;
      const dateOnly = typeof e.start === 'string' ? e.start.split('T')[0] : '';
      return !holidayDates.has(dateOnly);
    });
  })();

  return (
    <div style={{ height: 'calc(100vh - 60px)', display: 'flex', flexDirection: 'column', background: '#fff' }}>
      <style>{FC_STYLES}</style>

      {/* Custom toolbar */}
      <CalendarToolbar
        calendarRef={calendarRef}
        title={calendarTitle}
        view={currentView}
        onViewChange={setCurrentView}
      />

      {/* Calendar */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          locales={[jaLocale]}
          locale="ja"
          headerToolbar={false}
          selectable={true}
          selectMirror={true}
          unselectAuto={false}
          selectAllow={(span) => {
            if (span.allDay) return true;
            return span.end.valueOf() - span.start.valueOf() > 5 * 60 * 1000;
          }}
          editable={true}
          eventDrop={applyEventChange}
          eventResize={applyEventChange}
          select={handleDateSelect}
          dateClick={handleDateClick}
          eventClick={handleEventClick}
          datesSet={(arg) => {
            setCalendarTitle(arg.view.title);
            setCurrentView(arg.view.type);

            const mid = new Date((arg.view.activeStart.getTime() + arg.view.activeEnd.getTime()) / 2);
            const next = { year: mid.getFullYear(), month: mid.getMonth() + 1 };
            setViewYearMonth(prev =>
              prev.year === next.year && prev.month === next.month ? prev : next
            );
            setViewDateRange(prev => {
              if (
                prev?.start.getTime() === arg.view.activeStart.getTime() &&
                prev?.end.getTime() === arg.view.activeEnd.getTime()
              ) return prev;
              return { start: arg.view.activeStart, end: arg.view.activeEnd };
            });

            if (arg.view.type === 'timeGridDay' && prevViewTypeRef.current !== 'timeGridDay') {
              setTimeout(() => {
                const now = new Date();
                const h = Math.max(0, now.getHours() - 3);
                const m = now.getMinutes();
                calendarRef.current?.getApi().scrollToTime(
                  `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`
                );
              }, 0);
            }
            prevViewTypeRef.current = arg.view.type;
          }}
          allDaySlot={showAllDaySlot}
          navLinks={true}
          navLinkDayClick={(date, jsEvent) => {
            const dateStr = getLocalDateString(date);
            closeEditPopover();
            setCreateReferenceEl(jsEvent.target as HTMLElement);
            setModalInitial({ title: '', start: dateStr, end: dateStr, allDay: true, color: '#4B82F5' });
            setModalOpen(true);
            setPopoverEvent(null);
          }}
          ref={calendarRef}
          height="100%"
          nowIndicator={true}
          slotDuration="00:30:00"
          snapDuration="00:05:00"
          slotLabelInterval="01:00:00"

          dayHeaderClassNames={(arg) => {
            const dateStr = getLocalDateString(arg.date);
            const isHoliday = events.some(e => e.start === dateStr && e.className === 'is-holiday');
            return isHoliday ? ['is-holiday-column'] : [];
          }}
          dayCellClassNames={(arg) => {
            const dateStr = getLocalDateString(arg.date);
            const isHoliday = events.some(e => e.start === dateStr && e.className === 'is-holiday');
            return isHoliday ? ['is-holiday-column'] : [];
          }}

          eventContent={(arg) => {
            const props = arg.event.extendedProps as Record<string, unknown>;
            const kind = (props.kind as string) ?? 'personal';

            // Course events: use FC internal classes (styled via CSS)
            if (kind === 'course') {
              return (
                <div className="fc-event-main-frame" style={{ height: '100%' }}>
                  {arg.timeText && <div className="fc-event-time">{arg.timeText}</div>}
                  <div className="fc-event-title-container" style={{ flex: 1, overflow: 'hidden' }}>
                    <div className="fc-event-title fc-sticky">{arg.event.title || ' '}</div>
                  </div>
                </div>
              );
            }

            // Non-personal (holidays, university events): default FC structure
            if (kind !== 'personal') {
              return (
                <div className="fc-event-main-frame">
                  {arg.timeText && <div className="fc-event-time">{arg.timeText}</div>}
                  <div className="fc-event-title-container">
                    <div className="fc-event-title fc-sticky">{arg.event.title || ' '}</div>
                  </div>
                </div>
              );
            }

            // Personal events
            return (
              <div style={{
                padding: '3px 6px',
                height: '100%',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
              }}>
                {!arg.event.allDay && arg.timeText && (
                  <div style={{ fontSize: '10px', fontWeight: 600, opacity: 0.72, lineHeight: 1.3 }}>
                    {arg.timeText}
                  </div>
                )}
                <div style={{
                  fontWeight: 700,
                  fontSize: '11.5px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  lineHeight: 1.35,
                }}>
                  {arg.event.title}
                </div>
              </div>
            );
          }}

          events={filteredEvents}
        />
      </div>

      {/* 新規作成ポップアップ */}
      {modalOpen && (
        <EventCreatePopover
          key={`create-${modalInitial.start ?? ''}`}
          referenceEl={createReferenceEl}
          initialData={modalInitial}
          onSave={handleModalSave}
          onClose={() => {
            setModalOpen(false);
            setCreateReferenceEl(null);
            calendarRef.current?.getApi().unselect();
          }}
        />
      )}

      {/* 個人予定インライン編集ポップアップ */}
      {selectedEventId !== null && referenceEl !== null && selectedEventData !== null && (
        <EventEditPopover
          key={selectedEventId}
          referenceEl={referenceEl}
          eventId={selectedEventId.replace('personal-', '')}
          initialData={selectedEventData}
          onAutoSave={handleAutoSaveInline}
          onDelete={handleDeleteInline}
          onClose={closeEditPopover}
        />
      )}

      {/* 授業・大学イベント・祝日の読み取り専用ポップオーバー */}
      <EventPopover
        event={popoverEvent}
        anchorRect={popoverAnchor}
        anchorEl={popoverAnchorEl}
        onClose={closePopover}
      />
    </div>
  );
}
