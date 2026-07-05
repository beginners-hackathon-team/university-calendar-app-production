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
import { CalendarToolbar } from './CalendarToolbar';
import { FC_STYLES } from './calendarStyles';

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
