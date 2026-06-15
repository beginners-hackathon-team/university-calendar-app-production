import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
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
import {
  type AssignmentSortMode,
  type BoardVisible,
  type ColumnKey,
  type DoneItem,
  DEFAULT_COLUMN_WIDTH,
  TODO_VISIBLE_DEADLINE_RANK,
  applyTodoOrder,
  clampColumnWidth,
  columnLabels,
  getDeadlineMeta,
  getDoneTime,
  loadAssignmentKeep,
  loadAssignmentSortMode,
  loadAssignmentTodoPins,
  loadBoardOrder,
  loadBoardVisible,
  loadColumnWidths,
  loadTodoOrder,
  saveAssignmentKeep,
  saveAssignmentSortMode,
  saveAssignmentTodoPins,
  saveBoardOrder,
  saveBoardVisible,
  saveColumnWidths,
  saveTodoOrder,
} from '../lib/tasksBoard';
import KanbanBoard from '../components/tasks/KanbanBoard';

type ActiveDrag =
  | { type: 'assignment'; id: string }
  | { type: 'todo'; id: string }
  | { type: 'done'; doneKind: 'assignment' | 'todo'; id: string }
  | { type: 'column'; column: ColumnKey };

const TOGGLE_ORDER: ColumnKey[] = ['assignment', 'todo', 'done'];

function resolveOverColumn(data: Record<string, unknown> | undefined): ColumnKey | null {
  if (!data) return null;
  if (data.type === 'column') return data.column as ColumnKey;
  if (data.type === 'todo') return 'todo';
  if (data.type === 'assignment') return 'assignment';
  if (data.type === 'done') return 'done';
  return null;
}

export default function TasksPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [lmsSystemTypes, setLmsSystemTypes] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyKeys, setBusyKeys] = useState<Set<string>>(() => new Set());

  const [assignmentSortMode, setAssignmentSortMode] = useState<AssignmentSortMode>(loadAssignmentSortMode);
  const [visible, setVisible] = useState<BoardVisible>(loadBoardVisible);
  const [order, setOrder] = useState<ColumnKey[]>(loadBoardOrder);
  const [todoOrder, setTodoOrder] = useState<string[]>(loadTodoOrder);
  // TODOへ移動した課題 / 手動で課題に戻した課題（自動移動の対象外）。
  const [assignmentPins, setAssignmentPins] = useState<string[]>(loadAssignmentTodoPins);
  const [assignmentKeep, setAssignmentKeep] = useState<string[]>(loadAssignmentKeep);
  const [columnWidths, setColumnWidths] = useState<Partial<Record<ColumnKey, number>>>(loadColumnWidths);

  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);
  const [dropTargetColumn, setDropTargetColumn] = useState<ColumnKey | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const setBusy = (key: string, busy: boolean) => {
    setBusyKeys(prev => {
      const next = new Set(prev);
      if (busy) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const loadTasks = async () => {
    setLoading(true);
    setError('');
    try {
      const [assignmentRows, todoRows, systemTypes] = await Promise.all([
        fetchAssignments(),
        fetchTodos(),
        fetchLmsSystemTypes(),
      ]);
      setAssignments(assignmentRows);
      setTodos(todoRows);
      setLmsSystemTypes(systemTypes);
    } catch (err) {
      console.error(err);
      setError('タスクの読み込みに失敗しました。時間をおいて再読み込みしてください。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTasks();
  }, []);

  const pendingAssignments = useMemo(() => assignments.filter(a => !a.is_done), [assignments]);

  // TODOへ移動した課題: 明示的に移動した（pin） or 期限1週間以内（ただし手動で戻した=keep は除く）。
  const movedToTodoIds = useMemo(() => {
    const pinSet = new Set(assignmentPins);
    const keepSet = new Set(assignmentKeep);
    const ids = new Set<string>();
    for (const a of pendingAssignments) {
      const withinWeek = getDeadlineMeta(a.availability_end).rank <= TODO_VISIBLE_DEADLINE_RANK;
      if (pinSet.has(a.id) || (withinWeek && !keepSet.has(a.id))) ids.add(a.id);
    }
    return ids;
  }, [pendingAssignments, assignmentPins, assignmentKeep]);

  // 課題カラムに表示する課題（TODOへ移動したものは除外）。
  const assignmentColumnItems = useMemo(
    () => pendingAssignments.filter(a => !movedToTodoIds.has(a.id)),
    [pendingAssignments, movedToTodoIds],
  );

  const mirroredAssignments = useMemo(
    () => pendingAssignments.filter(a => movedToTodoIds.has(a.id)),
    [pendingAssignments, movedToTodoIds],
  );

  const pendingTodos = useMemo(() => todos.filter(t => !t.is_done), [todos]);
  const orderedTodos = useMemo(() => applyTodoOrder(pendingTodos, todoOrder), [pendingTodos, todoOrder]);

  // 最新の表示順を非同期ハンドラから参照するための ref。
  const orderedTodosRef = useRef<Todo[]>([]);
  orderedTodosRef.current = orderedTodos;

  const doneItems = useMemo<DoneItem[]>(() => {
    return [
      ...assignments.filter(a => a.is_done).map(a => ({ kind: 'assignment' as const, data: a })),
      ...todos.filter(t => t.is_done).map(t => ({ kind: 'todo' as const, data: t })),
    ].sort((a, b) => getDoneTime(b) - getDoneTime(a));
  }, [assignments, todos]);

  const visibleOrder = useMemo(() => order.filter(key => visible[key]), [order, visible]);

  const resolvedWidths = useMemo<Record<ColumnKey, number>>(() => ({
    assignment: columnWidths.assignment ?? DEFAULT_COLUMN_WIDTH,
    todo: columnWidths.todo ?? DEFAULT_COLUMN_WIDTH,
    done: columnWidths.done ?? DEFAULT_COLUMN_WIDTH,
  }), [columnWidths]);

  const handleResizeColumn = (key: ColumnKey, width: number) => {
    setColumnWidths(prev => {
      const next = { ...prev, [key]: clampColumnWidth(width) };
      saveColumnWidths(next);
      return next;
    });
  };

  // ---- 永続化付き setter --------------------------------------------

  const handleAssignmentSortChange = (mode: AssignmentSortMode) => {
    setAssignmentSortMode(mode);
    saveAssignmentSortMode(mode);
  };

  const toggleColumn = (key: ColumnKey) => {
    setVisible(prev => {
      const next = { ...prev, [key]: !prev[key] };
      saveBoardVisible(next);
      return next;
    });
  };

  // ---- API ハンドラ --------------------------------------------------

  const confirmMarkAssignmentDone = async (id: string) => {
    if (!window.confirm('この課題を完了にしますか？（完了の取り消しはできません）')) return;
    const key = `assignment-done-${id}`;
    setBusy(key, true);
    setError('');
    try {
      await markAssignmentDone(id);
      setAssignments(prev => prev.map(a => (a.id === id ? { ...a, is_done: true, done_at: new Date().toISOString() } : a)));
    } catch (err) {
      console.error(err);
      setError('課題を完了にできませんでした。');
    } finally {
      setBusy(key, false);
    }
  };

  const handleDeleteAssignment = async (id: string) => {
    const key = `assignment-delete-${id}`;
    setBusy(key, true);
    setError('');
    try {
      await deleteAssignment(id);
      setAssignments(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      console.error(err);
      setError('課題を削除できませんでした。');
    } finally {
      setBusy(key, false);
    }
  };

  // 課題 → TODO へ移動（課題カラムから消える）。
  const moveAssignmentToTodo = (id: string) => {
    setAssignmentPins(prev => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      saveAssignmentTodoPins(next);
      return next;
    });
    setAssignmentKeep(prev => {
      if (!prev.includes(id)) return prev;
      const next = prev.filter(x => x !== id);
      saveAssignmentKeep(next);
      return next;
    });
  };

  // TODO化した課題を課題カラムへ戻す（期限1週間以内でも自動移動させない）。
  const returnAssignmentToColumn = (id: string) => {
    setAssignmentPins(prev => {
      if (!prev.includes(id)) return prev;
      const next = prev.filter(x => x !== id);
      saveAssignmentTodoPins(next);
      return next;
    });
    setAssignmentKeep(prev => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      saveAssignmentKeep(next);
      return next;
    });
  };

  const handleCreateTodoBelow = async (afterId: string | null): Promise<string | undefined> => {
    if (busyKeys.has('todo-create')) return undefined;
    setBusy('todo-create', true);
    setError('');
    try {
      const todo = await createTodo('');
      setTodos(prev => [...prev, todo]);
      setTodoOrder(prev => {
        const base = prev.length ? prev.filter(id => id !== todo.id) : orderedTodosRef.current.map(t => t.id);
        const without = base.filter(id => id !== todo.id);
        const idx = afterId ? without.indexOf(afterId) : -1;
        const next = [...without];
        if (idx >= 0) next.splice(idx + 1, 0, todo.id);
        else next.push(todo.id);
        saveTodoOrder(next);
        return next;
      });
      return todo.id;
    } catch (err) {
      console.error(err);
      setError('TODOを追加できませんでした。');
      return undefined;
    } finally {
      setBusy('todo-create', false);
    }
  };

  const handleChangeTodoTitle = async (id: string, title: string) => {
    // 楽観更新（即時にローカル反映、その後サーバー保存）。
    setTodos(prev => prev.map(t => (t.id === id ? { ...t, title } : t)));
    try {
      await updateTodo(id, { title });
    } catch (err) {
      console.error(err);
      setError('TODOを保存できませんでした。');
    }
  };

  const handleToggleTodoDone = async (id: string, done: boolean) => {
    const key = `todo-toggle-${id}`;
    setBusy(key, true);
    setError('');
    try {
      const updated = await updateTodo(id, { is_done: done });
      setTodos(prev => prev.map(t => (t.id === id ? updated : t)));
    } catch (err) {
      console.error(err);
      setError('TODOの状態を更新できませんでした。');
    } finally {
      setBusy(key, false);
    }
  };

  const handleDeleteTodo = async (id: string) => {
    const key = `todo-delete-${id}`;
    setBusy(key, true);
    setError('');
    try {
      await deleteTodo(id);
      setTodos(prev => prev.filter(t => t.id !== id));
      setTodoOrder(prev => {
        const next = prev.filter(x => x !== id);
        saveTodoOrder(next);
        return next;
      });
    } catch (err) {
      console.error(err);
      setError('TODOを削除できませんでした。');
    } finally {
      setBusy(key, false);
    }
  };

  // ---- DnD ----------------------------------------------------------

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDrag((event.active.data.current ?? null) as ActiveDrag | null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const activeType = event.active.data.current?.type;
    if (activeType === 'column') {
      setDropTargetColumn(null);
      return;
    }
    setDropTargetColumn(resolveOverColumn(event.over?.data.current as Record<string, unknown> | undefined));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const active = (event.active.data.current ?? null) as ActiveDrag | null;
    const overData = event.over?.data.current as Record<string, unknown> | undefined;
    setActiveDrag(null);
    setDropTargetColumn(null);
    if (!active) return;

    const targetColumn = resolveOverColumn(overData);

    if (active.type === 'column') {
      if (targetColumn && targetColumn !== active.column) {
        setOrder(prev => {
          const fromIdx = prev.indexOf(active.column);
          const toIdx = prev.indexOf(targetColumn);
          if (fromIdx < 0 || toIdx < 0) return prev;
          const next = arrayMove(prev, fromIdx, toIdx);
          saveBoardOrder(next);
          return next;
        });
      }
      return;
    }

    if (active.type === 'assignment') {
      if (targetColumn === 'done') void confirmMarkAssignmentDone(active.id);
      else if (targetColumn === 'todo') moveAssignmentToTodo(active.id);
      else if (targetColumn === 'assignment') returnAssignmentToColumn(active.id);
      return;
    }

    if (active.type === 'todo') {
      if (targetColumn === 'done') {
        void handleToggleTodoDone(active.id, true);
        return;
      }
      if (targetColumn === 'todo' && overData?.type === 'todo') {
        const overId = overData.id as string;
        if (overId !== active.id) {
          const ids = orderedTodosRef.current.map(t => t.id);
          const from = ids.indexOf(active.id);
          const to = ids.indexOf(overId);
          if (from >= 0 && to >= 0) {
            const next = arrayMove(ids, from, to);
            setTodoOrder(next);
            saveTodoOrder(next);
          }
        }
      }
      return;
    }

    if (active.type === 'done') {
      // 完了 → TODO は「完了したTODO」のみ未完了に戻せる（課題は復帰不可）。
      if (active.doneKind === 'todo' && targetColumn === 'todo') void handleToggleTodoDone(active.id, false);
    }
  };

  const overlayLabel = useMemo(() => {
    if (!activeDrag) return null;
    if (activeDrag.type === 'column') return columnLabels[activeDrag.column];
    if (activeDrag.type === 'assignment') return assignments.find(a => a.id === activeDrag.id)?.task_name ?? '課題';
    const todo = todos.find(t => t.id === activeDrag.id);
    return todo?.title?.split('\n')[0] || 'TODO';
  }, [activeDrag, assignments, todos]);

  // タスク画面だけに適用する淡く落ち着いたパレット（global トークンを subtree で上書き）。
  const palette = {
    '--c-bg': '#F6F7F9',
    '--c-surface': '#FFFFFF',
    '--c-border': '#E0E2E7',
    '--c-border-hover': '#C7CAD1',
    '--c-text-1': '#1E222A',
    '--c-text-2': '#525965',
    '--c-text-3': '#8B919C',
    '--c-accent': '#5468A6',
    '--c-accent-h': '#445691',
    '--c-accent-bg': '#EAEEF7',
    '--c-danger': '#B0454F',
  } as React.CSSProperties;

  return (
    <div className="min-h-screen" style={{ ...palette, background: 'var(--c-bg)' }}>
      <div className="mx-auto px-5 py-8" style={{ maxWidth: 1400 }}>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <h1 className="font-bold text-[23px]" style={{ color: 'var(--c-text-1)', letterSpacing: '-0.025em' }}>
            タスク
          </h1>

          <div className="flex gap-1 p-1" style={{ background: '#F3F4F6', borderRadius: 10 }}>
            {TOGGLE_ORDER.map(key => (
              <button
                key={key}
                type="button"
                onClick={() => toggleColumn(key)}
                aria-pressed={visible[key]}
                className="text-[13px] font-semibold"
                style={{
                  padding: '6px 15px',
                  borderRadius: 8,
                  border: 'none',
                  cursor: 'pointer',
                  background: visible[key] ? '#fff' : 'transparent',
                  color: visible[key] ? 'var(--c-text-1)' : 'var(--c-text-3)',
                  boxShadow: visible[key] ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                  transition: 'background 0.15s, color 0.15s, box-shadow 0.15s',
                }}
              >
                {columnLabels[key]}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-4 flex flex-wrap items-center justify-between gap-3 text-[13px]"
            style={{ color: 'var(--c-danger)', background: '#FFF5F5', border: '1px solid #FED7D7', borderRadius: 12, padding: '11px 14px' }}
          >
            <span>{error}</span>
            <button
              onClick={() => void loadTasks()}
              className="font-semibold"
              style={{ border: 'none', background: 'transparent', color: 'var(--c-danger)', cursor: 'pointer', textDecoration: 'underline' }}
            >
              再読み込み
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="ku-spinner" />
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={() => {
              setActiveDrag(null);
              setDropTargetColumn(null);
            }}
          >
            <KanbanBoard
              visibleOrder={visibleOrder}
              dropTargetColumn={dropTargetColumn}
              columnWidths={resolvedWidths}
              pendingAssignments={assignmentColumnItems}
              mirroredAssignments={mirroredAssignments}
              orderedTodos={orderedTodos}
              doneItems={doneItems}
              systemTypes={lmsSystemTypes}
              busyKeys={busyKeys}
              assignmentSortMode={assignmentSortMode}
              onAssignmentSortModeChange={handleAssignmentSortChange}
              onChangeTodoTitle={handleChangeTodoTitle}
              onCreateTodoBelow={handleCreateTodoBelow}
              onDeleteTodo={handleDeleteTodo}
              onReturnAssignment={returnAssignmentToColumn}
              onDeleteAssignment={handleDeleteAssignment}
              onResizeColumn={handleResizeColumn}
            />

            <DragOverlay dropAnimation={null}>
              {overlayLabel && (
                <div
                  className="text-[13px] font-semibold"
                  style={{
                    padding: '8px 12px',
                    background: '#fff',
                    border: '1px solid var(--c-accent)',
                    borderRadius: 10,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.16)',
                    maxWidth: 280,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: 'var(--c-text-1)',
                  }}
                >
                  {overlayLabel}
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}
      </div>
    </div>
  );
}
