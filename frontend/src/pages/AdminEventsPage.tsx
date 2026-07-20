import { useEffect, useState } from 'react';
import {
  fetchUniversityEvents,
  createUniversityEvent,
  updateUniversityEvent,
  deleteUniversityEvent,
  type UniversityEvent,
} from '../api/universityEvents';

const TYPES = ['exam', 'transfer', 'interval', 'other'] as const;

export default function AdminEventsPage() {
  const [year, setYear] = useState(2026);
  const [events, setEvents] = useState<UniversityEvent[]>([]);
  const [editing, setEditing] = useState<UniversityEvent | null>(null);
  const [form, setForm] = useState<{ name: string; type: UniversityEvent['type']; date: string; original_day: string }>({ name: '', type: 'other', date: '', original_day: '' });

  const load = async () => {
    const data = await fetchUniversityEvents(year);
    setEvents(data);
  };
  useEffect(() => { load(); }, [year]);

  const handleSave = async () => {
    const data = {...form, year};
    if (editing) {
      await updateUniversityEvent(editing.id, data);
    } else {
      await createUniversityEvent(data);
    }
    setForm({ name: '', type: 'other', date: '', original_day: '' });
    setEditing(null);
    load();
  };

  const handleEdit = (ev: UniversityEvent) => {
    setEditing(ev);
    setForm({ name: ev.name, type: ev.type, date: ev.date, original_day: ev.original_day });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('削除しますか?')) return;
    await deleteUniversityEvent(id);
    load();
  };

  return (
    <div style={{ padding: 24 }}>
      <h1>大学イベント管理</h1>

      <div>
        年度: <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
      </div>

      <h2>{editing ? '編集' : '新規追加'}</h2>
      <input placeholder="名前" value={form.name}
             onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <select value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as UniversityEvent['type'] })}>
        {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
      <input placeholder="MM-DD" value={form.date}
             onChange={(e) => setForm({ ...form, date: e.target.value })} />
      <input placeholder="other(振替元曜日など)" value={form.original_day}
             onChange={(e) => setForm({ ...form, original_day: e.target.value })} />
      <button onClick={handleSave}>{editing ? '更新' : '追加'}</button>
      {editing && <button onClick={() => { setEditing(null); setForm({ name: '', type: 'other', date: '', original_day: '' }); }}>キャンセル</button>}

      <h2>一覧 ({year}年度)</h2>
      <table>
        <thead><tr><th>日付</th><th>名前</th><th>種別</th><th>備考</th><th></th></tr></thead>
        <tbody>
          {events.map((ev) => (
            <tr key={ev.id}>
              <td>{ev.date}</td>
              <td>{ev.name}</td>
              <td>{ev.type}</td>
              <td>{ev.original_day}</td>
              <td>
                <button onClick={() => handleEdit(ev)}>編集</button>
                <button onClick={() => handleDelete(ev.id)}>削除</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
