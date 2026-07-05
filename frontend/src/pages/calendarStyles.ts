/* ── FullCalendar CSS overrides ─────────────────── */

export const FC_STYLES = `
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
