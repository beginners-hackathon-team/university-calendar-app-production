import { useState, useEffect } from 'react';
import { periodToTime } from '../periodToTime';
import { fetchCourses } from '../api/courses';

const CURRENT_YEAR = 2026;

// Q開始日より前はその前のQとして扱う
// Q1: 4/6〜, Q2: 6/11〜, Q3: 10/1〜, Q4: 12/9〜
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

export default function CoursesPage() {
    const [coursesData, setCoursesData] = useState<{ [key: string]: Course }>({});
    const [intensiveCourses, setIntensiveCourses] = useState<Course[]>([]);

    const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
    const [selectedQuarter, setSelectedQuarter] = useState(getCurrentQuarter);

    // returnQuarter パラメータがあれば学期をsessionStorageに保存してリロード（データ反映のため）
    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const returnQuarter = params.get('returnQuarter')
        if (returnQuarter) {
            sessionStorage.setItem('coursesReturnQuarter', returnQuarter)
            window.history.replaceState(null, '', window.location.pathname)
            window.location.reload()
            return
        }
        const savedQuarter = sessionStorage.getItem('coursesReturnQuarter')
        if (savedQuarter) {
            sessionStorage.removeItem('coursesReturnQuarter')
            setSelectedQuarter(Number(savedQuarter))
        }
    }, [])

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

    const days = ["月", "火", "水", "木", "金", "土"];
    const periods = periodToTime;

    return (
        <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'sans-serif' }}>
            {/* 年度・クォーター選択セレクター */}
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: '20px', marginBottom: '30px' }}>
                <div style={selectorGroupStyle}>
                    <label style={labelStyle}>年度</label>
                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        style={selectStyle}
                    >
                        <option value={2026}>2026年度</option>
                    </select>
                </div>
                <div style={selectorGroupStyle}>
                    <label style={labelStyle}>学期</label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                        {([1, 2, 3, 4] as const).map(q => (
                            <button
                                key={q}
                                onClick={() => setSelectedQuarter(q)}
                                style={selectedQuarter === q ? quarterBtnActiveStyle : quarterBtnStyle}
                            >
                                Q{q}
                            </button>
                        ))}
                    </div>
                </div>
                <a
                    href={`https://eduweb.sta.kanazawa-u.ac.jp/Portal/StudentApp/Regist/RegistList.aspx?targetTerm=${{ 1: 'Q1', 2: 'Q2', 3: 'Q3', 4: 'Q4' }[selectedQuarter] ?? 'Q1'}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ ...portalButtonStyle, textDecoration: 'none', display: 'inline-block' }}
                >
                    時間割登録
                </a>
            </div>

            {/* 時間割テーブル */}
            <table style={{ borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed' }}>
                <thead>
                    <tr>
                        <th style={{ ...headerCellStyle, width: '80px' }}>時限</th>
                        {days.map(dayName => (
                            <th key={dayName} style={headerCellStyle}>{dayName}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {periods.map(pData => (
                        <tr key={pData.period}>
                            <td style={timeCellStyle}>
                                <strong>{pData.period}</strong><br/>
                                <small style={{ color: '#888', display: 'block', fontSize: '10px', marginTop: '4px' }}>
                                    {pData.start}<br/>~<br/>{pData.end}
                                </small>
                            </td>
                            {days.map(dayName => {
                                const key = `${dayName}${pData.period}`;
                                const course = coursesData[key];
                                return (
                                    <td key={dayName} style={contentCellStyle}>
                                        {course && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <div style={{ fontWeight: 'bold', fontSize: '14px', wordBreak: 'break-all' }}>
                                                    {course.lms_course_id ? (
                                                        <a
                                                            href={`https://acanthus.cis.kanazawa-u.ac.jp/base/lms-course/sso-link/?courseId=${course.lms_course_id}&systemType=${course.lms_system_type ?? ''}`}
                                                            target="webclass"
                                                            style={{ color: '#1a56db', textDecoration: 'none' }}
                                                        >
                                                            {course.name}
                                                        </a>
                                                    ) : (
                                                        <span style={{ color: '#2c3e50' }}>{course.name}</span>
                                                    )}
                                                </div>
                                                <div style={{ fontSize: '11px', color: '#7f8c8d' }}>👤 {course.teacher}</div>
                                                <div style={{ fontSize: '11px', color: '#e67e22' }}>📍 {course.room}</div>
                                            </div>
                                        )}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* 集中講義 */}
            {intensiveCourses.length > 0 && (
                <div style={{ marginTop: '40px' }}>
                    <h3 style={{ fontSize: '14px', color: '#555', marginBottom: '12px', fontWeight: 'bold' }}>集中講義</h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                        {intensiveCourses.map(course => (
                            <div key={course.id} style={intensiveCardStyle}>
                                <div style={{ fontWeight: 'bold', fontSize: '14px', wordBreak: 'break-all', marginBottom: '4px' }}>
                                    {course.lms_course_id ? (
                                        <a
                                            href={`https://acanthus.cis.kanazawa-u.ac.jp/base/lms-course/sso-link/?courseId=${course.lms_course_id}&systemType=${course.lms_system_type ?? ''}`}
                                            target="webclass"
                                            style={{ color: '#1a56db', textDecoration: 'none' }}
                                        >
                                            {course.name}
                                        </a>
                                    ) : (
                                        <span style={{ color: '#2c3e50' }}>{course.name}</span>
                                    )}
                                </div>
                                <div style={{ fontSize: '11px', color: '#7f8c8d' }}>👤 {course.teacher}</div>
                                <div style={{ fontSize: '11px', color: '#e67e22' }}>📍 {course.room}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// --- スタイル定義 ---
const selectorGroupStyle = { display: 'flex', flexDirection: 'column' as const, gap: '4px' };
const selectStyle = { padding: '8px 12px', borderRadius: '6px', border: '1px solid #ccc', backgroundColor: '#fff', cursor: 'pointer', fontSize: '20px' };
const labelStyle = { fontSize: '13px', fontWeight: 'bold', color: '#555' };

const portalButtonStyle = { padding: '8px 16px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' };

const quarterBtnBase = { padding: '8px 16px', borderRadius: '6px', border: '1px solid #ccc', cursor: 'pointer', fontSize: '20px', fontWeight: 'bold' as const };
const quarterBtnStyle = { ...quarterBtnBase, backgroundColor: '#fff', color: '#555' };
const quarterBtnActiveStyle = { ...quarterBtnBase, backgroundColor: '#1a56db', color: '#fff', border: '1px solid #1a56db' };

const intensiveCardStyle: React.CSSProperties = {
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '10px 14px',
    backgroundColor: '#f8fafc',
    minWidth: '160px',
    maxWidth: '220px',
};

const headerCellStyle = { borderBottom: '2px solid #333', borderRight: '1px solid #eee', padding: '12px 5px', textAlign: 'center' as const };
const timeCellStyle = { borderBottom: '1px solid #eee', borderRight: '2px solid #333', padding: '15px 5px', textAlign: 'center' as const };
const contentCellStyle = { borderBottom: '1px solid #eee', borderRight: '1px solid #eee', padding: '10px 5px', textAlign: 'center' as const, minHeight: '100px', verticalAlign: 'top' as const };
