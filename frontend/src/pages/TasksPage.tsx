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
import { arrayMove } from '@dnd-kit/sortable';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import type { Assignment, Todo } from '../api/tasks';
import {
  fetchAssignments,
  fetchLmsSystemTypes,
  updateAssignmentDone,
  updateAssignmentTitle,
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
  type TodoColumnItem,
  type TodoViewMode,
  DEFAULT_COLUMN_SHARE,
  applyTodoColumnOrder,
  columnLabels,
  getDoneTime,
  loadAssignmentSortMode,
  loadBoardOrder,
  loadBoardVisible,
  loadColumnShares,
  loadTodoColumnAssignmentIds,
  loadTodoColumnOrder,
  loadTodoViewMode,
  saveAssignmentSortMode,
  saveBoardOrder,
  saveBoardVisible,
  saveColumnShares,
  saveTodoColumnAssignmentIds,
  saveTodoColumnOrder,
  saveTodoViewMode,
  todoColumnItemKey,
} from '../lib/tasksBoard';
import KanbanBoard from '../components/tasks/KanbanBoard';

type DragColumn = 'assignment' | 'todo' | 'done';

type ActiveDrag =
  | { type: 'column'; column: ColumnKey }
  | { type: 'assignment'; column: DragColumn; id: string }
  | { type: 'todo'; column: DragColumn; id: string }
  | { type: 'done'; column: DragColumn; doneKind: 'assignment' | 'todo'; id: string };

const TOGGLE_ORDER: ColumnKey[] = ['assignment', 'todo', 'done'];

function resolveOverColumn(data: Record<string, unknown> | undefined): ColumnKey | null {
  if (!data) return null;
  return (data.column as ColumnKey | undefined) ?? null;
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
  const [columnShares, setColumnShares] = useState<Partial<Record<ColumnKey, number>>>(loadColumnShares);

  // TODOカラムへユーザーが手動で送った課題のID（自動移動はしない）。
  const [todoAssignmentIds, setTodoAssignmentIds] = useState<string[]>(loadTodoColumnAssignmentIds);
  // TODOカラム内（TODO本体・送られた課題を含む）の並び順。
  const [todoColumnOrder, setTodoColumnOrder] = useState<string[]>(loadTodoColumnOrder);
  // TODOカラムの表示モード（リスト / テキスト）。
  const [todoViewMode, setTodoViewMode] = useState<TodoViewMode>(loadTodoViewMode);

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

  // TODOへ送られた課題（ユーザー操作のみで管理。期限による自動移動はしない）。
  const todoColumnAssignments = useMemo(
    () => pendingAssignments.filter(a => todoAssignmentIds.includes(a.id)),
    [pendingAssignments, todoAssignmentIds],
  );

  // 課題カラムに表示する課題（TODOへ送ったものは除外）。
  const assignmentColumnItems = useMemo(
    () => pendingAssignments.filter(a => !todoAssignmentIds.includes(a.id)),
    [pendingAssignments, todoAssignmentIds],
  );

  const pendingTodos = useMemo(() => todos.filter(t => !t.is_done), [todos]);

  const todoColumnItems = useMemo<TodoColumnItem[]>(() => {
    const raw: TodoColumnItem[] = [
      ...pendingTodos.map(todo => ({ type: 'todo' as const, todo })),
      ...todoColumnAssignments.map(assignment => ({ type: 'assignment' as const, assignment })),
    ];
    return applyTodoColumnOrder(raw, todoColumnOrder);
  }, [pendingTodos, todoColumnAssignments, todoColumnOrder]);

  // 最新の表示順を非同期ハンドラから参照するための ref。
  const todoColumnItemsRef = useRef<TodoColumnItem[]>([]);
  todoColumnItemsRef.current = todoColumnItems;

  const doneItems = useMemo<DoneItem[]>(() => {
    return [
      ...assignments.filter(a => a.is_done).map(a => ({ kind: 'assignment' as const, data: a })),
      ...todos.filter(t => t.is_done).map(t => ({ kind: 'todo' as const, data: t })),
    ].sort((a, b) => getDoneTime(b) - getDoneTime(a));
  }, [assignments, todos]);

  const visibleOrder = useMemo(() => order.filter(key => visible[key]), [order, visible]);

  const resolvedShares = useMemo<Record<ColumnKey, number>>(() => ({
    assignment: columnShares.assignment ?? DEFAULT_COLUMN_SHARE,
    todo: columnShares.todo ?? DEFAULT_COLUMN_SHARE,
    done: columnShares.done ?? DEFAULT_COLUMN_SHARE,
  }), [columnShares]);

  const handleResizeColumns = (a: ColumnKey, b: ColumnKey, shareA: number, shareB: number) => {
    setColumnShares(prev => {
      const next = { ...prev, [a]: shareA, [b]: shareB };
      saveColumnShares(next);
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
    // 表示列が変わるたびに幅は等分へリセットする（例: 課題を消したら TODO 左半分・完了 右半分になる）。
    setColumnShares({});
    saveColumnShares({});
  };

  const handleTodoViewModeChange = (mode: TodoViewMode) => {
    setTodoViewMode(mode);
    saveTodoViewMode(mode);
  };

  // ---- 課題 ⇄ TODOカラムの所属管理 ------------------------------------

  const addAssignmentToTodoColumn = (id: string) => {
    setTodoAssignmentIds(prev => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      saveTodoColumnAssignmentIds(next);
      return next;
    });
    setTodoColumnOrder(prev => {
      const key = `assignment:${id}`;
      if (prev.includes(key)) return prev;
      const next = [...prev, key];
      saveTodoColumnOrder(next);
      return next;
    });
  };

  const removeAssignmentFromTodoColumn = (id: string) => {
    setTodoAssignmentIds(prev => {
      if (!prev.includes(id)) return prev;
      const next = prev.filter(x => x !== id);
      saveTodoColumnAssignmentIds(next);
      return next;
    });
    setTodoColumnOrder(prev => {
      const key = `assignment:${id}`;
      if (!prev.includes(key)) return prev;
      const next = prev.filter(x => x !== key);
      saveTodoColumnOrder(next);
      return next;
    });
  };

  // ---- API ハンドラ --------------------------------------------------

  const setAssignmentDone = async (id: string, isDone: boolean) => {
    const key = `assignment-done-${id}`;
    setBusy(key, true);
    setError('');
    try {
      await updateAssignmentDone(id, isDone);
      setAssignments(prev => prev.map(a => (
        a.id === id ? { ...a, is_done: isDone, done_at: isDone ? new Date().toISOString() : null } : a
      )));
    } catch (err) {
      console.error(err);
      setError(isDone ? '課題を完了にできませんでした。' : '課題を完了から戻せませんでした。');
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

  const handleCreateTodoWithTitle = async (title: string) => {
    if (busyKeys.has('todo-create')) return;
    setBusy('todo-create', true);
    setError('');
    try {
      const todo = await createTodo(title);
      setTodos(prev => [...prev, todo]);
      setTodoColumnOrder(prev => {
        const next = [...prev, `todo:${todo.id}`];
        saveTodoColumnOrder(next);
        return next;
      });
    } catch (err) {
      console.error(err);
      setError('TODOを追加できませんでした。');
    } finally {
      setBusy('todo-create', false);
    }
  };

  const handleCreateTodoBelow = async (afterId: string | null): Promise<string | undefined> => {
    if (busyKeys.has('todo-create')) return undefined;
    setBusy('todo-create', true);
    setError('');
    try {
      const todo = await createTodo('');
      setTodos(prev => [...prev, todo]);
      setTodoColumnOrder(prev => {
        const base = prev.length ? prev : todoColumnItemsRef.current.map(todoColumnItemKey);
        const without = base.filter(key => key !== `todo:${todo.id}`);
        // afterId は Todo の id だけでなく、課題ブロックの id（Enter での新規作成）も指せる。
        const idx = afterId ? without.findIndex(key => key === `todo:${afterId}` || key === `assignment:${afterId}`) : -1;
        const next = [...without];
        if (idx >= 0) next.splice(idx + 1, 0, `todo:${todo.id}`);
        else next.push(`todo:${todo.id}`);
        saveTodoColumnOrder(next);
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

  // 課題ブロックの授業名行でEnterしたときなど、指定したブロックの直前に新しいTodoを作る。
  const handleCreateTodoBefore = async (beforeId: string): Promise<string | undefined> => {
    if (busyKeys.has('todo-create')) return undefined;
    setBusy('todo-create', true);
    setError('');
    try {
      const todo = await createTodo('');
      setTodos(prev => [...prev, todo]);
      setTodoColumnOrder(prev => {
        const base = prev.length ? prev : todoColumnItemsRef.current.map(todoColumnItemKey);
        const newKey = `todo:${todo.id}`;
        const without = base.filter(key => key !== newKey);
        const idx = without.findIndex(key => key === `todo:${beforeId}` || key === `assignment:${beforeId}`);
        const next = [...without];
        if (idx >= 0) next.splice(idx, 0, newKey);
        else next.unshift(newKey);
        saveTodoColumnOrder(next);
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

  const handleChangeAssignmentTitle = async (id: string, taskName: string) => {
    // 楽観更新（即時にローカル反映、その後サーバー保存）。課題名以外（授業名・期限など）は変更不可。
    setAssignments(prev => prev.map(a => (a.id === id ? { ...a, task_name: taskName } : a)));
    try {
      await updateAssignmentTitle(id, taskName);
    } catch (err) {
      console.error(err);
      setError('課題名を保存できませんでした。');
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
      setTodoColumnOrder(prev => {
        const next = prev.filter(key => key !== `todo:${id}`);
        saveTodoColumnOrder(next);
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

  const reorderTodoColumn = (activeKey: string, overData: Record<string, unknown> | undefined) => {
    const overType = overData?.type as 'todo' | 'assignment' | undefined;
    const overId = overData?.id as string | undefined;
    if (!overType || !overId) return;
    const overKey = `${overType}:${overId}`;
    if (activeKey === overKey) return;
    const keys = todoColumnItemsRef.current.map(todoColumnItemKey);
    const from = keys.indexOf(activeKey);
    const to = keys.indexOf(overKey);
    if (from < 0 || to < 0) return;
    const next = arrayMove(keys, from, to);
    setTodoColumnOrder(next);
    saveTodoColumnOrder(next);
  };

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

    // 課題カラムの課題: TODOへ移動できる / 完了へ移動できる（確認モーダルなし）。
    if (active.type === 'assignment') {
      const { id, column: sourceColumn } = active;
      if (targetColumn === 'done') {
        void setAssignmentDone(id, true);
        return;
      }
      if (targetColumn === 'todo') {
        if (sourceColumn !== 'todo') {
          addAssignmentToTodoColumn(id);
        } else if (overData?.type === 'todo' || overData?.type === 'assignment') {
          reorderTodoColumn(`assignment:${id}`, overData);
        }
        return;
      }
      // TODOカラム内の課題は課題カラムへ戻せる。課題カラム内では同列ドロップ＝何もしない。
      if (targetColumn === 'assignment' && sourceColumn === 'todo') {
        removeAssignmentFromTodoColumn(id);
      }
      return;
    }

    // TODOカラムのTODO: 完了へ移動できる。課題カラムへは移動できない。
    if (active.type === 'todo') {
      const { id } = active;
      if (targetColumn === 'done') {
        void handleToggleTodoDone(id, true);
        return;
      }
      if (targetColumn === 'todo' && (overData?.type === 'todo' || overData?.type === 'assignment')) {
        reorderTodoColumn(`todo:${id}`, overData);
      }
      return;
    }

    // 完了カラム内のアイテム: TODOは未完了に戻せる。課題は課題カラム/TODOカラムへ戻せる。
    if (active.type === 'done') {
      const { id, doneKind } = active;
      if (doneKind === 'todo') {
        if (targetColumn === 'todo') void handleToggleTodoDone(id, false);
        return;
      }
      if (targetColumn === 'assignment') {
        void setAssignmentDone(id, false);
        removeAssignmentFromTodoColumn(id);
      } else if (targetColumn === 'todo') {
        void setAssignmentDone(id, false);
        addAssignmentToTodoColumn(id);
      }
    }
  };

  const overlayLabel = useMemo(() => {
    if (!activeDrag) return null;
    if (activeDrag.type === 'column') return columnLabels[activeDrag.column];
    // TODOカラム内のブロック（Todo・送られた課題）はブロック自体の浮き上がりだけで表現し、
    // カーソル追従のラベル表示は出さない。
    if (activeDrag.type === 'todo') return null;
    if (activeDrag.type === 'assignment' && activeDrag.column === 'todo') return null;
    if (activeDrag.type === 'assignment' || (activeDrag.type === 'done' && activeDrag.doneKind === 'assignment')) {
      return assignments.find(a => a.id === activeDrag.id)?.task_name ?? '課題';
    }
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
              columnShares={resolvedShares}
              pendingAssignments={assignmentColumnItems}
              todoColumnItems={todoColumnItems}
              todoViewMode={todoViewMode}
              doneItems={doneItems}
              systemTypes={lmsSystemTypes}
              busyKeys={busyKeys}
              assignmentSortMode={assignmentSortMode}
              onAssignmentSortModeChange={handleAssignmentSortChange}
              onTodoViewModeChange={handleTodoViewModeChange}
              onCreateTodo={title => void handleCreateTodoWithTitle(title)}
              onCreateTodoBelow={handleCreateTodoBelow}
              onCreateTodoBefore={handleCreateTodoBefore}
              onChangeTodoTitle={handleChangeTodoTitle}
              onChangeAssignmentTitle={handleChangeAssignmentTitle}
              onDeleteTodo={handleDeleteTodo}
              onDeleteAssignment={handleDeleteAssignment}
              onResizeColumns={handleResizeColumns}
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
