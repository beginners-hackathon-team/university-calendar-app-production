import { useState, useEffect } from 'react';
import type { Assignment, Todo } from '../api/tasks';
import {
  fetchAssignments,
  markAssignmentDone,
  deleteAssignment,
  fetchTodos,
  createTodo,
  updateTodo,
  deleteTodo,
} from '../api/tasks';

type Tab = 'assignment' | 'todo' | 'done';

export default function TasksPage() {
  const [tab, setTab] = useState<Tab>('assignment');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodoTitle, setNewTodoTitle] = useState('');

  useEffect(() => {
    fetchAssignments().then(setAssignments).catch(console.error);
    fetchTodos().then(setTodos).catch(console.error);
  }, []);

  const pendingAssignments = assignments.filter(a => !a.is_done);
  const doneAssignments = assignments.filter(a => a.is_done);
  const pendingTodos = todos.filter(t => !t.is_done);
  const doneTodos = todos.filter(t => t.is_done);

  const handleMarkAssignmentDone = async (id: string) => {
    await markAssignmentDone(id);
    setAssignments(prev => prev.map(a => a.id === id ? { ...a, is_done: true } : a));
  };

  const handleDeleteAssignment = async (id: string) => {
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
      <h1 style={pageTitleStyle}>タスク</h1>

      <div style={tabBarStyle}>
        <button
          style={tab === 'assignment' ? activeTabStyle : tabStyle}
          onClick={() => setTab('assignment')}
        >
          課題
          {pendingAssignments.length > 0 && (
            <span style={badgeStyle}>{pendingAssignments.length}</span>
          )}
        </button>
        <button
          style={tab === 'todo' ? activeTabStyle : tabStyle}
          onClick={() => setTab('todo')}
        >
          TODO
          {pendingTodos.length > 0 && (
            <span style={badgeStyle}>{pendingTodos.length}</span>
          )}
        </button>
        <button
          style={tab === 'done' ? activeTabStyle : tabStyle}
          onClick={() => setTab('done')}
        >
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
                  <AssignmentCard
                    key={a.id}
                    assignment={a}
                    onDone={() => handleMarkAssignmentDone(a.id)}
                    onDelete={() => handleDeleteAssignment(a.id)}
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
              <div style={listStyle}>
                {pendingTodos.map(t => (
                  <TodoItem
                    key={t.id}
                    todo={t}
                    onToggle={() => handleToggleTodo(t.id, !t.is_done)}
                    onDelete={() => handleDeleteTodo(t.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Doneタブ */}
        {tab === 'done' && (
          <>
            {doneAssignments.length === 0 && doneTodos.length === 0 ? (
              <p style={emptyStyle}>完了したアイテムはありません</p>
            ) : (
              <>
                {doneAssignments.length > 0 && (
                  <>
                    <h2 style={sectionTitleStyle}>課題</h2>
                    <div style={cardGridStyle}>
                      {doneAssignments.map(a => (
                        <AssignmentCard
                          key={a.id}
                          assignment={a}
                          done
                          onDelete={() => handleDeleteAssignment(a.id)}
                        />
                      ))}
                    </div>
                  </>
                )}
                {doneTodos.length > 0 && (
                  <>
                    <h2 style={sectionTitleStyle}>TODO</h2>
                    <div style={listStyle}>
                      {doneTodos.map(t => (
                        <TodoItem
                          key={t.id}
                          todo={t}
                          done
                          onToggle={() => handleToggleTodo(t.id, !t.is_done)}
                          onDelete={() => handleDeleteTodo(t.id)}
                        />
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function AssignmentCard({
  assignment: a,
  done = false,
  onDone,
  onDelete,
}: {
  assignment: Assignment;
  done?: boolean;
  onDone?: () => void;
  onDelete: () => void;
}) {
  return (
    <div style={{ ...cardStyle, opacity: done ? 0.6 : 1 }}>
      {a.course_name && (
        <div style={courseNameStyle}>{a.course_name}</div>
      )}
      <div style={taskNameStyle}>{a.task_name}</div>
      <div style={metaRowStyle}>
        <span style={resultBadgeStyle(a.result)}>{a.result}</span>
        {a.score && <span style={scoreStyle}>{a.score}</span>}
      </div>
      {a.submitted_at && (
        <div style={submittedStyle}>提出: {a.submitted_at}</div>
      )}
      <div style={cardActionsStyle}>
        {!done && onDone && (
          <button onClick={onDone} style={doneButtonStyle}>完了にする</button>
        )}
        <button onClick={onDelete} style={deleteSmallBtnStyle}>削除</button>
      </div>
    </div>
  );
}

function TodoItem({
  todo: t,
  done = false,
  onToggle,
  onDelete,
}: {
  todo: Todo;
  done?: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div style={todoItemStyle}>
      <input
        type="checkbox"
        checked={t.is_done}
        onChange={onToggle}
        style={{ cursor: 'pointer', marginRight: '10px', width: '16px', height: '16px', flexShrink: 0 }}
      />
      <span style={{ flex: 1, textDecoration: done ? 'line-through' : 'none', color: done ? '#9ca3af' : '#111827', fontSize: '15px' }}>
        {t.title}
      </span>
      <button onClick={onDelete} style={deleteSmallBtnStyle}>削除</button>
    </div>
  );
}

// --- スタイル ---

const pageStyle: React.CSSProperties = {
  maxWidth: '800px',
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
  backgroundColor: 'white',
  border: '1px solid #e5e7eb',
  borderRadius: '10px',
  padding: '16px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
};

const courseNameStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#6b7280',
  marginBottom: '6px',
  fontWeight: 'bold',
};

const taskNameStyle: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: 'bold',
  color: '#111827',
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

const deleteSmallBtnStyle: React.CSSProperties = {
  padding: '8px 12px',
  backgroundColor: 'white',
  color: '#ef4444',
  border: '1px solid #fca5a5',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '13px',
};

const listStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
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

const todoItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '14px 16px',
  backgroundColor: 'white',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '15px',
  fontWeight: 'bold',
  color: '#6b7280',
  marginBottom: '12px',
  marginTop: '24px',
};
