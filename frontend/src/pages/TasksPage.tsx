import { useState, useEffect } from 'react';
import type { Assignment, Todo } from '../api/tasks';
import { buildAcanthusSsoUrl } from '../lib/universityUrls';
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
      const ta = a.availability_end ? Date.parse(a.availability_end.replace(/\//g, '-').replace(' ', 'T')) : Infinity;
      const tb = b.availability_end ? Date.parse(b.availability_end.replace(/\//g, '-').replace(' ', 'T')) : Infinity;
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

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'assignment', label: '課題', count: pendingAssignments.length || undefined },
    { key: 'todo', label: 'TODO', count: pendingTodos.length || undefined },
    { key: 'done', label: '完了' },
  ];

  return (
    <div className="min-h-screen" style={{ background: 'var(--c-bg)' }}>
      <div className="mx-auto px-5 py-10" style={{ maxWidth: 900 }}>

        {/* Page header */}
        <h1
          className="font-bold text-[23px] mb-7"
          style={{ color: 'var(--c-text-1)', letterSpacing: '-0.025em' }}
        >
          タスク
        </h1>

        {/* Tab bar — segmented control style */}
        <div
          className="flex gap-1 p-1 mb-8 w-fit"
          style={{ background: '#ECEEF2', borderRadius: 13 }}
        >
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="flex items-center gap-2 font-semibold text-[13px] transition-all duration-150"
              style={{
                padding: '7px 20px',
                borderRadius: 10,
                border: 'none',
                cursor: 'pointer',
                background: tab === t.key ? '#fff' : 'transparent',
                color: tab === t.key ? 'var(--c-text-1)' : 'var(--c-text-3)',
                boxShadow: tab === t.key ? '0 1px 4px rgba(0,0,0,0.09)' : 'none',
              }}
            >
              {t.label}
              {t.count !== undefined && (
                <span
                  className="text-[11px] font-bold"
                  style={{
                    background: 'var(--c-accent)',
                    color: '#fff',
                    borderRadius: 999,
                    padding: '1px 7px',
                    lineHeight: '18px',
                    minWidth: 20,
                    textAlign: 'center',
                  }}
                >
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Assignment tab */}
        {tab === 'assignment' && (
          <div>
            {pendingAssignments.length === 0 ? (
              <EmptyState label="現在の課題はありません" />
            ) : (
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                {pendingAssignments.map(a => (
                  <TaskCard
                    key={a.id}
                    type="assignment"
                    title={a.task_name}
                    subtitle={a.course_name ?? undefined}
                    subtitleHref={a.lms_course_id
                      ? buildAcanthusSsoUrl(a.lms_course_id, lmsSystemTypes[a.lms_course_id] ?? '')
                      : undefined}
                    badge={a.kind ?? undefined}
                    deadline={a.availability_end ?? undefined}
                    result={a.result || undefined}
                    score={a.score ?? undefined}
                    submittedAt={a.submitted_at ?? undefined}
                    onDone={() => handleMarkAssignmentDone(a.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* TODO tab */}
        {tab === 'todo' && (
          <div>
            <div className="flex gap-2 mb-6">
              <input
                value={newTodoTitle}
                onChange={e => setNewTodoTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddTodo()}
                placeholder="新しいTODOを入力して Enter"
                className="ku-input flex-1 text-[14px]"
                style={{
                  padding: '10px 14px',
                  borderRadius: 'var(--r-input)',
                  border: '1.5px solid var(--c-border)',
                  color: 'var(--c-text-1)',
                  background: '#fff',
                }}
              />
              <button
                onClick={handleAddTodo}
                className="font-semibold text-[13.5px] text-white"
                style={{
                  padding: '10px 20px',
                  borderRadius: 10,
                  border: 'none',
                  background: 'var(--c-accent)',
                  cursor: 'pointer',
                  boxShadow: '0 1px 4px rgba(75,130,245,0.25)',
                  flexShrink: 0,
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--c-accent-h)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--c-accent)'; }}
              >
                追加
              </button>
            </div>
            {pendingTodos.length === 0 ? (
              <EmptyState label="TODOはありません" />
            ) : (
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
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
          </div>
        )}

        {/* Done tab */}
        {tab === 'done' && (
          <div>
            <p
              className="text-[13px] mb-5 rounded-[10px] px-4 py-2.5"
              style={{
                color: 'var(--c-text-3)',
                background: '#fff',
                border: '1px solid var(--c-border)',
              }}
            >
              完了アイテムは1週間後に自動削除されます
            </p>
            {doneItems.length === 0 ? (
              <EmptyState label="完了したアイテムはありません" />
            ) : (
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                {doneItems.map(item =>
                  item.kind === 'assignment' ? (
                    <TaskCard
                      key={item.data.id}
                      type="assignment"
                      title={item.data.task_name}
                      subtitle={item.data.course_name ?? undefined}
                      subtitleHref={item.data.lms_course_id
                        ? buildAcanthusSsoUrl(item.data.lms_course_id, lmsSystemTypes[item.data.lms_course_id] ?? '')
                        : undefined}
                      badge={item.data.kind ?? undefined}
                      deadline={item.data.availability_end ?? undefined}
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
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────── */

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16" style={{ color: 'var(--c-text-3)' }}>
      <div
        className="mb-3"
        style={{ width: 36, height: 36, borderRadius: '50%', background: '#ECEEF2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 3.5v5M8 10.5v1" stroke="#9AA5B4" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <p className="text-[14px]">{label}</p>
    </div>
  );
}

function deadlineStyle(until: string): { color: string; fontWeight?: 'bold' } {
  const parsed = Date.parse(until.replace(/\//g, '-').replace(' ', 'T'));
  if (isNaN(parsed)) return { color: '#9AA5B4' };
  const diffDays = (parsed - Date.now()) / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return { color: '#9AA5B4' };
  if (diffDays < 1) return { color: '#E53E3E', fontWeight: 'bold' };
  if (diffDays < 3) return { color: '#DD6B20', fontWeight: 'bold' };
  if (diffDays < 7) return { color: '#D69E2E' };
  return { color: '#9AA5B4' };
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
  return (
    <div
      className="flex flex-col"
      style={{
        background: '#fff',
        border: '1px solid var(--c-border)',
        borderRadius: 13,
        padding: '16px 16px 14px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        opacity: done ? 0.65 : 1,
      }}
    >
      {/* Top meta row */}
      {(subtitle || badge) && (
        <div className="flex justify-between items-start gap-2 mb-2">
          {subtitle && (
            subtitleHref ? (
              <a
                href={subtitleHref}
                target="webclass"
                className="text-[12px] font-semibold hover:underline"
                style={{ color: 'var(--c-accent)' }}
              >
                {subtitle}
              </a>
            ) : (
              <span className="text-[12px] font-semibold" style={{ color: 'var(--c-text-2)' }}>
                {subtitle}
              </span>
            )
          )}
          {badge && (
            <span
              className="text-[11px] font-semibold flex-shrink-0"
              style={{
                padding: '2px 9px',
                borderRadius: 999,
                background: 'var(--c-accent-bg)',
                color: 'var(--c-accent)',
              }}
            >
              {badge}
            </span>
          )}
        </div>
      )}

      {/* Task name */}
      <div
        className="text-[15px] font-bold leading-snug mb-3"
        style={{
          color: done ? 'var(--c-text-3)' : 'var(--c-text-1)',
          textDecoration: done ? 'line-through' : 'none',
        }}
      >
        {title}
      </div>

      {/* Deadline */}
      {deadline && (
        <div className="text-[12.5px] mb-2.5 font-medium" style={deadlineStyle(deadline)}>
          期限: {deadline}
        </div>
      )}

      {/* Result / Score */}
      {(result || score) && (
        <div className="flex items-center gap-2 mb-2">
          {result && (
            <span
              className="text-[12px] font-bold"
              style={{
                padding: '2px 10px',
                borderRadius: 999,
                background: result === '○' ? '#D1FAE5' : '#FEE2E2',
                color: result === '○' ? '#065F46' : '#991B1B',
              }}
            >
              {result}
            </span>
          )}
          {score && (
            <span className="text-[12px]" style={{ color: 'var(--c-text-2)' }}>{score}</span>
          )}
        </div>
      )}

      {/* Submitted at */}
      {submittedAt && (
        <div className="text-[11.5px] mb-2" style={{ color: 'var(--c-text-3)' }}>
          提出: {submittedAt}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-auto pt-3">
        {!done && onDone && (
          <button
            onClick={onDone}
            className="flex-1 font-semibold text-[13px] text-white"
            style={{
              padding: '8px 0',
              borderRadius: 8,
              border: 'none',
              background: 'var(--c-accent)',
              cursor: 'pointer',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--c-accent-h)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--c-accent)'; }}
          >
            完了にする
          </button>
        )}
        {done && onToggleUndone && (
          <button
            onClick={onToggleUndone}
            className="text-[13px] font-medium"
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid var(--c-border)',
              background: '#fff',
              color: 'var(--c-text-2)',
              cursor: 'pointer',
            }}
          >
            戻す
          </button>
        )}
        {done && onDelete && (
          <button
            onClick={onDelete}
            className="text-[13px] font-medium"
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid #FCA5A5',
              background: '#fff',
              color: 'var(--c-danger)',
              cursor: 'pointer',
            }}
          >
            削除
          </button>
        )}
      </div>
    </div>
  );
}
