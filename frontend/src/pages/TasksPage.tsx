import { useState, useEffect } from 'react';
import type { Assignment, Todo } from '../api/tasks';
import {
  fetchAssignments,
  fetchLmsSystemTypes,
  markAssignmentDone,
  deleteAssignment,
  fetchTodos,
  createTodo,
  updateTodo,
  deleteTodo,
} from '../api/tasks';

type Tab = 'assignment' | 'todo' | 'done';

type DoneItem =
  | { kind: 'assignment'; data: Assignment }
  | { kind: 'todo'; data: Todo };

export default function TasksPage() {
  const [tab, setTab] = useState<Tab>('assignment');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [lmsSystemTypes, setLmsSystemTypes] = useState<Record<string, string | null>>({});

  useEffect(() => {
    fetchAssignments().then(setAssignments).catch(console.error);
    fetchTodos().then(setTodos).catch(console.error);
    fetchLmsSystemTypes().then(setLmsSystemTypes).catch(console.error);
  }, []);

  const pendingAssignments = assignments
    .filter(a => !a.is_done)
    .sort((a, b) => {
      const ta = a.available_until ? Date.parse(a.available_until.replace(/\//g, '-').replace(' ', 'T')) : Infinity;
      const tb = b.available_until ? Date.parse(b.available_until.replace(/\//g, '-').replace(' ', 'T')) : Infinity;
      return ta - tb;
    });

  const pendingTodos = todos.filter(t => !t.is_done);

  const doneItems: DoneItem[] = [
    ...assignments.filter(a => a.is_done).map(a => ({ kind: 'assignment' as const, data: a })),
    ...todos.filter(t => t.is_done).map(t => ({ kind: 'todo' as const, data: t })),
  ].sort((a, b) => {
    const ta = a.data.done_at ? Date.parse(a.data.done_at) : 0;
    const tb = b.data.done_at ? Date.parse(b.data.done_at) : 0;
    return tb - ta;
  });

  const handleMarkAssignmentDone = async (id: string) => {
    await markAssignmentDone(id);
    setAssignments(prev => prev.map(a => a.id === id ? { ...a, is_done: true, done_at: new Date().toISOString() } : a));
  };

  const handleHideAssignment = async (id: string) => {
    await deleteAssignment(id);
    setAssignments(prev => prev.filter(a => a.id !== id));
  };

  const handleAddTodo = async () => {
    const title = newTodoTitle.trim();
    if (!title) return;
    const todo = await createTodo(title);
    setTodos(prev => [...prev, todo]);
    setNewTodoTitle('');
  };

  const handleToggleTodo = async (id: string, isDone: boolean) => {
    const updated = await updateTodo(id, { is_done: isDone });
    setTodos(prev => prev.map(t => t.id === id ? updated : t));
  };

  const handleDeleteTodo = async (id: string) => {
    await deleteTodo(id);
    setTodos(prev => prev.filter(t => t.id !== id));
  };

  return (
    <div style={pageStyle}>
      <div style={tabBarStyle}>
        <button style={tab === 'assignment' ? activeTabStyle : tabStyle} onClick={() => setTab('assignment')}>
          課題
          {pendingAssignments.length > 0 && <span style={badgeStyle}>{pendingAssignments.length}</span>}
        </button>
        <button style={tab === 'todo' ? activeTabStyle : tabStyle} onClick={() => setTab('todo')}>
          TODO
          {pendingTodos.length > 0 && <span style={badgeStyle}>{pendingTodos.length}</span>}
        </button>
        <button style={tab === 'done' ? activeTabStyle : tabStyle} onClick={() => setTab('done')}>
          Done
        </button>
      </div>

      <div style={contentStyle}>
        {/* 課題タブ */}
        {tab === 'assignment' && (
          <>
            <p style={hintStyle}>拡張機能のLMS情報取得ボタンで課題を同期できます</p>
            {pendingAssignments.length === 0 ? (
              <p style={emptyStyle}>課題はありません</p>
            ) : (
              <div style={cardGridStyle}>
                {pendingAssignments.map(a => (
                  <TaskCard
                    key={a.id}
                    type="assignment"
                    title={a.task_name}
                    subtitle={a.course_name ?? undefined}
                    subtitleHref={a.lms_course_id
                      ? `https://acanthus.cis.kanazawa-u.ac.jp/base/lms-course/sso-link/?courseId=${a.lms_course_id}&systemType=${lmsSystemTypes[a.lms_course_id] ?? ''}`
                      : undefined}
                    badge={a.kind ?? undefined}
                    deadline={a.available_until ?? undefined}
                    result={a.result || undefined}
                    score={a.score ?? undefined}
                    submittedAt={a.submitted_at ?? undefined}
                    onDone={() => handleMarkAssignmentDone(a.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* TODOタブ */}
        {tab === 'todo' && (
          <>
            <div style={addTodoStyle}>
              <input
                value={newTodoTitle}
                onChange={e => setNewTodoTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddTodo()}
                placeholder="新しいTODOを入力... (Enterで追加)"
                style={todoInputStyle}
              />
              <button onClick={handleAddTodo} style={addBtnStyle}>追加</button>
            </div>
            {pendingTodos.length === 0 ? (
              <p style={emptyStyle}>TODOはありません</p>
            ) : (
              <div style={cardGridStyle}>
                {pendingTodos.map(t => (
                  <TaskCard
                    key={t.id}
                    type="todo"
                    title={t.title}
                    onDone={() => handleToggleTodo(t.id, true)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Doneタブ */}
        {tab === 'done' && (
          <>
            <p style={retentionNoteStyle}>Done したアイテムは1週間保持されます。1週間後に自動で消えます。</p>
            {doneItems.length === 0 ? (
              <p style={emptyStyle}>完了したアイテムはありません</p>
            ) : (
              <div style={cardGridStyle}>
                {doneItems.map(item =>
                  item.kind === 'assignment' ? (
                    <TaskCard
                      key={item.data.id}
                      type="assignment"
                      title={item.data.task_name}
                      subtitle={item.data.course_name ?? undefined}
                      subtitleHref={item.data.lms_course_id
                        ? `https://acanthus.cis.kanazawa-u.ac.jp/base/lms-course/sso-link/?courseId=${item.data.lms_course_id}&systemType=${lmsSystemTypes[item.data.lms_course_id] ?? ''}`
                        : undefined}
                      badge={item.data.kind ?? undefined}
                      deadline={item.data.available_until ?? undefined}
                      result={item.data.result || undefined}
                      score={item.data.score ?? undefined}
                      submittedAt={item.data.submitted_at ?? undefined}
                      done
                      onDelete={() => handleHideAssignment(item.data.id)}
                    />
                  ) : (
                    <TaskCard
                      key={item.data.id}
                      type="todo"
                      title={item.data.title}
                      done
                      onToggleUndone={() => handleToggleTodo(item.data.id, false)}
                      onDelete={() => handleDeleteTodo(item.data.id)}
                    />
                  )
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function deadlineColor(until: string): React.CSSProperties {
  const parsed = Date.parse(until.replace(/\//g, '-').replace(' ', 'T'));
  if (isNaN(parsed)) return { color: '#9ca3af' };
  const diffDays = (parsed - Date.now()) / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return { color: '#9ca3af' };
  if (diffDays < 1) return { color: '#dc2626', fontWeight: 'bold' };
  if (diffDays < 3) return { color: '#ea580c', fontWeight: 'bold' };
  if (diffDays < 7) return { color: '#d97706' };
  return { color: '#6b7280' };
}

function TaskCard({
  type,
  title,
  subtitle,
  subtitleHref,
  badge,
  deadline,
  result,
  score,
  submittedAt,
  done = false,
  onDone,
  onToggleUndone,
  onDelete,
}: {
  type: 'assignment' | 'todo';
  title: string;
  subtitle?: string;
  subtitleHref?: string;
  badge?: string;
  deadline?: string;
  result?: string;
  score?: string;
  submittedAt?: string;
  done?: boolean;
  onDone?: () => void;
  onToggleUndone?: () => void;
  onDelete?: () => void;
}) {
  const cardBg = type === 'assignment'
    ? { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }
    : { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' };

  return (
    <div style={{ ...cardStyle, ...cardBg, opacity: done ? 0.7 : 1 }}>
      {(subtitle || badge) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
          {subtitle && (
            subtitleHref
              ? <a href={subtitleHref} target="webclass" style={subtitleLinkStyle}>{subtitle}</a>
              : <div style={subtitleStyle}>{subtitle}</div>
          )}
          {badge && <span style={badgeTagStyle}>{badge}</span>}
        </div>
      )}
      <div style={{ ...taskNameStyle, textDecoration: done ? 'line-through' : 'none', color: done ? '#9ca3af' : '#111827' }}>
        {title}
      </div>
      {deadline && (
        <div style={{ ...deadlineStyle, ...deadlineColor(deadline) }}>
          期限: {deadline}
        </div>
      )}
      {(result || score) && (
        <div style={metaRowStyle}>
          {result && <span style={resultBadgeStyle(result)}>{result}</span>}
          {score && <span style={scoreStyle}>{score}</span>}
        </div>
      )}
      {submittedAt && <div style={submittedStyle}>提出: {submittedAt}</div>}

      <div style={cardActionsStyle}>
        {!done && onDone && (
          <button onClick={onDone} style={doneButtonStyle}>完了にする</button>
        )}
        {done && onToggleUndone && (
          <button onClick={onToggleUndone} style={undoneButtonStyle}>戻す</button>
        )}
        {done && onDelete && (
          <button onClick={onDelete} style={deleteSmallBtnStyle}>削除</button>
        )}
      </div>
    </div>
  );
}

// --- スタイル ---

const pageStyle: React.CSSProperties = {
  maxWidth: '900px',
  margin: '0 auto',
  padding: '32px 24px',
  fontFamily: 'sans-serif',
};

const pageTitleStyle: React.CSSProperties = {
  fontSize: '28px',
  fontWeight: 'bold',
  color: '#111827',
  marginBottom: '24px',
  textAlign: 'center',
};

const tabBarStyle: React.CSSProperties = {
  display: 'flex',
  borderBottom: '2px solid #e5e7eb',
  marginBottom: '24px',
};

const tabStyle: React.CSSProperties = {
  padding: '12px 24px',
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  fontSize: '15px',
  color: '#6b7280',
  borderBottom: '3px solid transparent',
  marginBottom: '-2px',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
};

const activeTabStyle: React.CSSProperties = {
  ...tabStyle,
  color: '#4f46e5',
  borderBottom: '3px solid #4f46e5',
  fontWeight: 'bold',
};

const badgeStyle: React.CSSProperties = {
  backgroundColor: '#ef4444',
  color: 'white',
  borderRadius: '999px',
  fontSize: '11px',
  padding: '1px 7px',
  fontWeight: 'bold',
};

const contentStyle: React.CSSProperties = {};

const hintStyle: React.CSSProperties = {
  fontSize: '13px',
  color: '#9ca3af',
  marginBottom: '16px',
};

const retentionNoteStyle: React.CSSProperties = {
  fontSize: '13px',
  color: '#9ca3af',
  marginBottom: '16px',
  padding: '10px 14px',
  backgroundColor: '#f9fafb',
  borderRadius: '8px',
  border: '1px solid #e5e7eb',
};

const emptyStyle: React.CSSProperties = {
  color: '#9ca3af',
  fontSize: '15px',
  textAlign: 'center',
  marginTop: '48px',
};

const cardGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
  gap: '16px',
};

const cardStyle: React.CSSProperties = {
  border: '1px solid',
  borderRadius: '10px',
  padding: '16px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
};

const subtitleStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#6b7280',
  fontWeight: 'bold',
};

const subtitleLinkStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#1a56db',
  fontWeight: 'bold',
  textDecoration: 'none',
};

const taskNameStyle: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: 'bold',
  marginBottom: '10px',
  lineHeight: '1.4',
};

const metaRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  marginBottom: '6px',
};

const resultBadgeStyle = (result: string): React.CSSProperties => ({
  fontSize: '12px',
  fontWeight: 'bold',
  padding: '2px 10px',
  borderRadius: '999px',
  backgroundColor: result === '○' ? '#d1fae5' : '#fee2e2',
  color: result === '○' ? '#065f46' : '#991b1b',
});

const scoreStyle: React.CSSProperties = {
  fontSize: '13px',
  color: '#6b7280',
};

const deadlineStyle: React.CSSProperties = {
  fontSize: '13px',
  marginBottom: '8px',
};

const badgeTagStyle: React.CSSProperties = {
  fontSize: '11px',
  padding: '2px 8px',
  borderRadius: '999px',
  backgroundColor: '#ede9fe',
  color: '#5b21b6',
  fontWeight: 'bold',
  whiteSpace: 'nowrap',
};

const submittedStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#9ca3af',
  marginBottom: '10px',
};

const cardActionsStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  marginTop: '12px',
};

const doneButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: '8px 0',
  backgroundColor: '#4f46e5',
  color: 'white',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: 'bold',
};

const undoneButtonStyle: React.CSSProperties = {
  padding: '8px 12px',
  backgroundColor: 'white',
  color: '#6b7280',
  border: '1px solid #d1d5db',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '13px',
};

const deleteSmallBtnStyle: React.CSSProperties = {
  padding: '8px 12px',
  backgroundColor: 'white',
  color: '#ef4444',
  border: '1px solid #fca5a5',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '13px',
};

const addTodoStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  marginBottom: '20px',
};

const todoInputStyle: React.CSSProperties = {
  flex: 1,
  padding: '10px 14px',
  border: '1px solid #d1d5db',
  borderRadius: '8px',
  fontSize: '14px',
  outline: 'none',
};

const addBtnStyle: React.CSSProperties = {
  padding: '10px 20px',
  backgroundColor: '#4f46e5',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: 'bold',
};
