import React, { useState, useEffect } from 'react';
import { periodToTime } from '../periodToTime';
import { fetchCourses } from '../api/courses';
import { buildPortalRegistListUrl, buildAcanthusSsoUrl } from '../lib/universityUrls';
import { useIsMobile } from '../hooks/useIsMobile';

const CURRENT_YEAR = 2026;

function getCurrentQuarter(): number {
  const today = new Date();
  const mmdd = (today.getMonth() + 1) * 100 + today.getDate();
  if (mmdd < 406) return 4;
  if (mmdd < 611) return 1;
  if (mmdd < 1001) return 2;
  if (mmdd < 1209) return 3;
  return 4;
}

type Course = {
  id: string;
  name: string;
  teacher: string;
  room: string;
  year: number;
  quarter: number;
  day_of_week: string | null;
  period: number;
  is_intensive_lct: boolean;
  lms_course_id: string | null;
  lms_system_type: string | null;
};

function ArrowUpRight() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
      <path d="M2 9L9 2M9 2H4.5M9 2V6.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const QUARTER_PORTAL: Record<number, string> = { 1: 'Q1', 2: 'Q2', 3: 'Q3', 4: 'Q4' };

export default function CoursesPage() {
  const [coursesData, setCoursesData] = useState<{ [key: string]: Course }>({});
  const [intensiveCourses, setIntensiveCourses] = useState<Course[]>([]);
  const [selectedYear] = useState(CURRENT_YEAR);
  const [selectedQuarter, setSelectedQuarter] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const rq = params.get('returnQuarter');
    if (rq) {
      const q = parseInt(rq, 10);
      if (q >= 1 && q <= 4) return q;
    }
    return getCurrentQuarter();
  });
  const isMobile = useIsMobile();

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('returnQuarter')) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    fetchCourses(selectedYear, selectedQuarter).then((data: Course[]) => {
      const map: { [key: string]: Course } = {};
      const intensive: Course[] = [];
      for (const row of data) {
        if (row.is_intensive_lct) {
          intensive.push(row);
        } else {
          const key = `${row.day_of_week}${row.period}`;
          map[key] = row;
        }
      }
      setCoursesData(map);
      setIntensiveCourses(intensive);
    });
  }, [selectedYear, selectedQuarter]);

  const days = ['月', '火', '水', '木', '金', '土'];
  const periods = periodToTime;

  // Mobile: period col = 30px, Mon-Fri fit screen exactly, Sat scrollable off-screen
  const periodColWidth = isMobile ? 30 : 60;

  return (
    <div className="min-h-screen" style={{ background: 'var(--c-bg)' }}>
      <div className="mx-auto px-3 py-4 sm:px-5 sm:py-8" style={{ maxWidth: 1240 }}>

        {/* Compact header: year + quarter selector (centered) + register link (right) */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-[13px] font-medium shrink-0" style={{ color: 'var(--c-text-3)' }}>
            {selectedYear}年度
          </span>

          {/* Quarter selector — centered in remaining space */}
          <div className="flex flex-1 justify-center">
            <div
              className="flex gap-1 p-1"
              style={{ background: '#ECEEF2', borderRadius: 12 }}
            >
              {([1, 2, 3, 4] as const).map(q => (
                <button
                  key={q}
                  onClick={() => setSelectedQuarter(q)}
                  className="font-semibold text-[13px] transition-all duration-150"
                  style={{
                    padding: '7px 14px',
                    borderRadius: 9,
                    border: 'none',
                    cursor: 'pointer',
                    background: selectedQuarter === q ? '#fff' : 'transparent',
                    color: selectedQuarter === q ? 'var(--c-accent)' : 'var(--c-text-3)',
                    boxShadow: selectedQuarter === q ? '0 1px 4px rgba(0,0,0,0.09)' : 'none',
                  }}
                >
                  Q{q}
                </button>
              ))}
            </div>
          </div>

          {/* Portal registration link — narrow, right-aligned */}
          <a
            href={buildPortalRegistListUrl(QUARTER_PORTAL[selectedQuarter] ?? 'Q1')}
            target="_blank"
            rel="noopener noreferrer"
            className="ku-portal-btn shrink-0"
            style={isMobile
              ? { padding: '5px 8px', fontSize: 11, gap: 3 }
              : { padding: '7px 14px', fontSize: 13, gap: 4 }
            }
          >
            時間割登録
            <ArrowUpRight />
          </a>
        </div>

        {/* Timetable card */}
        <div
          className="bg-white overflow-hidden"
          style={{
            borderRadius: 'var(--r-card)',
            border: '1px solid var(--c-border)',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          }}
        >
          <div className="overflow-x-auto">
            <table
              style={{
                borderCollapse: 'collapse',
                // Mobile: table is wider than viewport so Mon-Fri fills screen and Sat is off-screen
                width: isMobile ? `calc(120vw - 6px)` : '100%',
                tableLayout: 'fixed',
                minWidth: isMobile ? undefined : 560,
              }}
            >
              <colgroup>
                <col style={{ width: periodColWidth }} />
                {days.map(d => (
                  <col
                    key={d}
                    style={{
                      width: isMobile ? `calc((100vw - 30px) / 5)` : undefined,
                      minWidth: isMobile ? undefined : 84,
                    }}
                  />
                ))}
              </colgroup>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--c-border)' }}>
                  <th
                    className="py-2 text-[11px] font-semibold"
                    style={{
                      color: 'var(--c-text-3)',
                      textAlign: 'center',
                      borderRight: '1px solid var(--c-border)',
                      background: '#FAFBFC',
                      ...(isMobile ? { position: 'sticky', left: 0, zIndex: 3 } : {}),
                    }}
                  >
                    {isMobile ? '' : '時限'}
                  </th>
                  {days.map(day => (
                    <th
                      key={day}
                      className="py-2 text-[13px] font-semibold"
                      style={{
                        textAlign: 'center',
                        color: 'var(--c-text-2)',
                        borderRight: '1px solid var(--c-border)',
                        background: '#FAFBFC',
                      }}
                    >
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periods.map((pData, rowIdx) => (
                  <tr
                    key={pData.period}
                    style={{ borderBottom: rowIdx < periods.length - 1 ? '1px solid var(--c-border)' : 'none' }}
                  >
                    {/* Period label */}
                    <td
                      className="text-center align-top"
                      style={{
                        padding: isMobile ? '6px 2px' : '10px 4px',
                        borderRight: '1px solid var(--c-border)',
                        background: '#FAFBFC',
                        ...(isMobile ? { position: 'sticky', left: 0, zIndex: 1 } : {}),
                      }}
                    >
                      <div className={isMobile ? 'text-[11px] font-bold' : 'text-[13px] font-bold'} style={{ color: 'var(--c-text-2)' }}>
                        {pData.period}
                      </div>
                      {!isMobile && (
                        <div className="text-[9px] mt-1 leading-relaxed" style={{ color: 'var(--c-text-3)' }}>
                          {pData.start}
                          <br />–<br />
                          {pData.end}
                        </div>
                      )}
                    </td>

                    {/* Day cells */}
                    {days.map(dayName => {
                      const key = `${dayName}${pData.period}`;
                      const course = coursesData[key];
                      return (
                        <td
                          key={dayName}
                          className="align-top"
                          style={{
                            padding: 5,
                            borderRight: '1px solid var(--c-border)',
                            minHeight: 90,
                            verticalAlign: 'top',
                          }}
                        >
                          {course && <CourseCell course={course} />}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Intensive courses */}
        {intensiveCourses.length > 0 && (
          <div className="mt-6">
            <h2
              className="text-[14px] font-semibold mb-4"
              style={{ color: 'var(--c-text-2)' }}
            >
              集中講義
            </h2>
            <div className="flex flex-wrap gap-3">
              {intensiveCourses.map(course => (
                <CourseCell key={course.id} course={course} compact />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CourseCell({ course, compact = false }: { course: Course; compact?: boolean }) {
  const lmsUrl = course.lms_course_id
    ? buildAcanthusSsoUrl(course.lms_course_id, course.lms_system_type ?? '')
    : null;

  const cardStyle: React.CSSProperties = {
    background: '#EBF5EB',
    border: '1px solid #B2DEB2',
    borderRadius: compact ? 12 : 6,
    padding: compact ? '12px 16px' : '6px 7px',
    minHeight: compact ? undefined : 82,
    minWidth: compact ? 160 : undefined,
    maxWidth: compact ? 220 : undefined,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    height: compact ? undefined : '100%',
    textDecoration: 'none',
    cursor: lmsUrl ? 'pointer' : 'default',
    transition: lmsUrl ? 'border-color 0.12s, background 0.12s' : undefined,
    writingMode: 'horizontal-tb',
    overflowWrap: 'anywhere',
    wordBreak: 'break-word',
  };

  const content = (
    <>
      <div
        className="text-[11.5px] font-bold leading-snug"
        style={{
          color: '#1565C0',
          writingMode: 'horizontal-tb',
          overflowWrap: 'anywhere',
          wordBreak: 'break-word',
          whiteSpace: 'normal',
        }}
      >
        {course.name}
      </div>
      {course.teacher && (
        <div
          className="text-[10px] leading-snug"
          style={{
            color: 'var(--c-text-3)',
            overflowWrap: 'anywhere',
            wordBreak: 'break-word',
            whiteSpace: 'normal',
          }}
        >
          {course.teacher}
        </div>
      )}
      {course.room && (
        <div
          className="text-[10px] leading-snug"
          style={{
            color: 'var(--c-text-2)',
            overflowWrap: 'anywhere',
            wordBreak: 'break-word',
            whiteSpace: 'normal',
          }}
        >
          {course.room}
        </div>
      )}
    </>
  );

  if (lmsUrl) {
    return (
      <a
        href={lmsUrl}
        target="webclass"
        rel="noopener noreferrer"
        style={cardStyle}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.borderColor = '#81C784';
          (e.currentTarget as HTMLElement).style.background = '#D4EDDA';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.borderColor = '#B2DEB2';
          (e.currentTarget as HTMLElement).style.background = '#EBF5EB';
        }}
      >
        {content}
      </a>
    );
  }

  return <div style={cardStyle}>{content}</div>;
}
