import { useEffect, useMemo, useRef, useState } from 'react';
import { useIsMobile } from '../hooks/useIsMobile';
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
  type Modifier,
} from '@dnd-kit/core';

// ドラッグ中のオーバーレイを「横：中央・縦：やや下寄り」で掴んでいるように見せるモディファイア。
// grabX/Y はオーバーレイ内でカーソルが来てほしい位置（左端・上端からの距離）。
const snapToPointerModifier: Modifier = ({ activatorEvent, draggingNodeRect, transform }) => {
  if (!activatorEvent || !draggingNodeRect) return transform;
  const event = activatorEvent as PointerEvent;
  if (typeof event.clientX !== 'number') return transform;
  const grabX = draggingNodeRect.width / 2;
  const grabY = draggingNodeRect.height * 0.6;
  return {
    ...transform,
    x: transform.x + event.clientX - draggingNodeRect.left - grabX,
    y: transform.y + event.clientY - draggingNodeRect.top - grabY,
  };
};
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
  applyAssignmentColumnOrder,
  applyDoneColumnOrder,
  applyTodoColumnOrder,
  columnLabels,
  doneColumnItemKey,
  getDoneTime,
  loadAssignmentColumnOrder,
  loadAssignmentSortMode,
  loadBoardOrder,
  loadBoardVisible,
  loadColumnShares,
  loadDoneColumnOrder,
  loadTodoColumnAssignmentIds,
  loadTodoColumnOrder,
  loadTodoViewMode,
  saveAssignmentColumnOrder,
  saveAssignmentSortMode,
  saveBoardOrder,
  saveBoardVisible,
  saveColumnShares,
  saveDoneColumnOrder,
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
  // 課題カラムの手動並び順（ID配列）。ソートモード変更時にリセット。
  const [assignmentColumnOrder, setAssignmentColumnOrder] = useState<string[]>(loadAssignmentColumnOrder);
  // 完了カラムの手動並び順（"kind:id" キー配列）。
  const [doneColumnOrder, setDoneColumnOrder] = useState<string[]>(loadDoneColumnOrder);

  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);
  const [dropTargetColumn, setDropTargetColumn] = useState<ColumnKey | null>(null);

  const isMobile = useIsMobile();
  const [mobileTab, setMobileTab] = useState<ColumnKey>('assignment');
  const touchStartX = useRef<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: isMobile
        ? { delay: 300, tolerance: 8 }
        : { distance: 6 },
    }),
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

  // 課題カラムに表示する課題（TODOへ送ったものは除外、手動並び順を適用）。
  const assignmentColumnItems = useMemo(
    () => applyAssignmentColumnOrder(
      pendingAssignments.filter(a => !todoAssignmentIds.includes(a.id)),
      assignmentColumnOrder,
      assignmentSortMode,
    ),
    [pendingAssignments, todoAssignmentIds, assignmentColumnOrder, assignmentSortMode],
  );
  const assignmentColumnItemsRef = useRef<typeof assignmentColumnItems>([]);
  assignmentColumnItemsRef.current = assignmentColumnItems;

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
    const raw: DoneItem[] = [
      ...assignments.filter(a => a.is_done).map(a => ({ kind: 'assignment' as const, data: a })),
      ...todos.filter(t => t.is_done).map(t => ({ kind: 'todo' as const, data: t })),
    ].sort((a, b) => getDoneTime(b) - getDoneTime(a));
    return applyDoneColumnOrder(raw, doneColumnOrder);
  }, [assignments, todos, doneColumnOrder]);
  const doneColumnItemsRef = useRef<DoneItem[]>([]);
  doneColumnItemsRef.current = doneItems;

  const visibleOrder = useMemo(() => order.filter(key => visible[key]), [order, visible]);
  const mobileVisibleOrder = useMemo<ColumnKey[]>(() => isMobile ? [mobileTab] : visibleOrder, [isMobile, mobileTab, visibleOrder]);

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
    setAssignmentColumnOrder([]);
    saveAssignmentColumnOrder([]);
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

  // insertBeforeKey が指定された場合はその直前に挿入、省略時は末尾に追加。
  const addAssignmentToTodoColumn = (id: string, insertBeforeKey?: string) => {
    setTodoAssignmentIds(prev => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      saveTodoColumnAssignmentIds(next);
      return next;
    });
    setTodoColumnOrder(() => {
      const key = `assignment:${id}`;
      const currentKeys = todoColumnItemsRef.current.map(todoColumnItemKey);
      if (currentKeys.includes(key)) return currentKeys;
      if (insertBeforeKey) {
        const to = currentKeys.indexOf(insertBeforeKey);
        if (to >= 0) {
          const next = [...currentKeys];
          next.splice(to, 0, key);
          saveTodoColumnOrder(next);
          return next;
        }
      }
      const next = [...currentKeys, key];
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
        const next = [`todo:${todo.id}`, ...prev];
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

  // ---- ボタン操作ハンドラ --------------------------------------------

  // 課題カラム: Todo→
  const handleMoveAssignmentToTodo = (id: string) => {
    addAssignmentToTodoColumn(id);
  };

  // 課題カラム / Todoカラム: 完了→ (課題)
  const handleMoveAssignmentToDone = (id: string) => {
    insertIntoDoneColumn(`assignment:${id}`);
    void setAssignmentDone(id, true);
  };

  // Todoカラム内の課題: ←課題
  const handleMoveTodoAssignmentToAssignment = (id: string) => {
    removeAssignmentFromTodoColumn(id);
    insertIntoAssignmentColumn(id);
  };

  // Todoカラム: 完了→ (Todo)
  const handleMoveTodoToDone = (id: string) => {
    insertIntoDoneColumn(`todo:${id}`);
    void handleToggleTodoDone(id, true);
  };

  // 完了カラムの課題: ←課題
  const handleMoveDoneAssignmentToAssignment = (id: string) => {
    void setAssignmentDone(id, false);
    removeAssignmentFromTodoColumn(id);
    insertIntoAssignmentColumn(id);
  };

  // 完了カラムの課題: ←Todo
  const handleMoveDoneAssignmentToTodo = (id: string) => {
    void setAssignmentDone(id, false);
    addAssignmentToTodoColumn(id);
  };

  // 完了カラムのTodo: ←Todo
  const handleMoveDoneTodoToTodo = (id: string) => {
    void handleToggleTodoDone(id, false);
  };

  // ---- DnD ----------------------------------------------------------

  // 課題カラム内の並び替え（deadline-asc モードのみ永続化）。
  const reorderAssignmentColumn = (activeId: string, overData: Record<string, unknown> | undefined) => {
    const overId = overData?.id as string | undefined;
    if (!overId || activeId === overId) return;
    const ids = assignmentColumnItemsRef.current.map(a => a.id);
    const from = ids.indexOf(activeId);
    const to = ids.indexOf(overId);
    if (from < 0 || to < 0) return;
    const next = arrayMove(ids, from, to);
    setAssignmentColumnOrder(next);
    saveAssignmentColumnOrder(next);
  };

  // 課題カラムへの位置指定挿入（他カラムから戻ってきたとき）。
  const insertIntoAssignmentColumn = (id: string, insertBeforeId?: string) => {
    const currentIds = assignmentColumnItemsRef.current.map(a => a.id);
    if (insertBeforeId) {
      const to = currentIds.indexOf(insertBeforeId);
      if (to >= 0) {
        const next = [...currentIds];
        next.splice(to, 0, id);
        setAssignmentColumnOrder(next);
        saveAssignmentColumnOrder(next);
        return;
      }
    }
    const next = [...currentIds, id];
    setAssignmentColumnOrder(next);
    saveAssignmentColumnOrder(next);
  };

  // 完了カラム内の並び替え。
  const reorderDoneColumn = (activeKey: string, overData: Record<string, unknown> | undefined) => {
    const overDoneKind = overData?.doneKind as string | undefined;
    const overId = overData?.id as string | undefined;
    if (!overDoneKind || !overId) return;
    const overKey = `${overDoneKind}:${overId}`;
    if (activeKey === overKey) return;
    const keys = doneColumnItemsRef.current.map(doneColumnItemKey);
    const from = keys.indexOf(activeKey);
    const to = keys.indexOf(overKey);
    if (from < 0 || to < 0) return;
    const next = arrayMove(keys, from, to);
    setDoneColumnOrder(next);
    saveDoneColumnOrder(next);
  };

  // 完了カラムへの位置指定挿入（他カラムから来たとき）。
  const insertIntoDoneColumn = (newKey: string, insertBeforeKey?: string) => {
    const currentKeys = doneColumnItemsRef.current.map(doneColumnItemKey);
    if (insertBeforeKey) {
      const to = currentKeys.indexOf(insertBeforeKey);
      if (to >= 0) {
        const next = [...currentKeys];
        next.splice(to, 0, newKey);
        setDoneColumnOrder(next);
        saveDoneColumnOrder(next);
        return;
      }
    }
    const next = [...currentKeys, newKey];
    setDoneColumnOrder(next);
    saveDoneColumnOrder(next);
  };

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

    // 課題カラムの課題: TODOへ移動、完了へ移動、カラム内並び替え
    if (active.type === 'assignment') {
      const { id, column: sourceColumn } = active;

      if (targetColumn === 'done') {
        void setAssignmentDone(id, true);
        const insertBeforeKey = overData?.type === 'done'
          ? `${overData.doneKind as string}:${overData.id as string}`
          : undefined;
        insertIntoDoneColumn(`assignment:${id}`, insertBeforeKey);
        return;
      }

      if (targetColumn === 'todo') {
        if (sourceColumn !== 'todo') {
          const insertBeforeKey = (overData?.type === 'todo' || overData?.type === 'assignment')
            ? `${overData.type as string}:${overData.id as string}`
            : undefined;
          addAssignmentToTodoColumn(id, insertBeforeKey);
        } else if (overData?.type === 'todo' || overData?.type === 'assignment') {
          reorderTodoColumn(`assignment:${id}`, overData);
        }
        return;
      }

      if (targetColumn === 'assignment') {
        if (sourceColumn === 'todo') {
          removeAssignmentFromTodoColumn(id);
          if (overData?.type === 'assignment') {
            insertIntoAssignmentColumn(id, overData.id as string);
          }
        } else if (sourceColumn === 'assignment' && overData?.type === 'assignment' && assignmentSortMode === 'deadline-asc') {
          reorderAssignmentColumn(id, overData);
        }
        return;
      }
    }

    // TODOカラムのTODO: 完了へ移動、カラム内並び替え。課題カラムへは行けない。
    if (active.type === 'todo') {
      const { id } = active;

      if (targetColumn === 'done') {
        void handleToggleTodoDone(id, true);
        const insertBeforeKey = overData?.type === 'done'
          ? `${overData.doneKind as string}:${overData.id as string}`
          : undefined;
        insertIntoDoneColumn(`todo:${id}`, insertBeforeKey);
        return;
      }

      if (targetColumn === 'todo' && (overData?.type === 'todo' || overData?.type === 'assignment')) {
        reorderTodoColumn(`todo:${id}`, overData);
      }
      return;
    }

    // 完了カラム内のアイテム: カラム内並び替え、TODOへ戻す、課題カラム/TODOへ戻す
    if (active.type === 'done') {
      const { id, doneKind } = active;

      if (doneKind === 'todo') {
        if (targetColumn === 'todo') void handleToggleTodoDone(id, false);
        return;
      }

      // doneKind === 'assignment'
      if (targetColumn === 'assignment') {
        void setAssignmentDone(id, false);
        removeAssignmentFromTodoColumn(id);
        if (overData?.type === 'assignment') {
          insertIntoAssignmentColumn(id, overData.id as string);
        }
        return;
      }

      if (targetColumn === 'todo') {
        void setAssignmentDone(id, false);
        const insertBeforeKey = (overData?.type === 'todo' || overData?.type === 'assignment')
          ? `${overData.type as string}:${overData.id as string}`
          : undefined;
        addAssignmentToTodoColumn(id, insertBeforeKey);
        return;
      }

      if (targetColumn === 'done' && overData?.type === 'done') {
        reorderDoneColumn(`${doneKind}:${id}`, overData);
      }
    }
  };

  const overlayLabel = useMemo(() => {
    if (!activeDrag) return null;
    if (activeDrag.type === 'column') return columnLabels[activeDrag.column];
    if (activeDrag.type === 'assignment' || (activeDrag.type === 'done' && activeDrag.doneKind === 'assignment')) {
      return assignments.find(a => a.id === activeDrag.id)?.task_name ?? '課題';
    }
    // todo（TODOカラム内・完了カラム内どちらも）はタイトルを表示。
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
    <div
      className="min-h-screen"
      style={{ ...palette, background: 'var(--c-bg)' }}
      onTouchStart={isMobile ? (e) => { const t = e.touches[0]; if (t) touchStartX.current = t.clientX; } : undefined}
      onTouchEnd={isMobile ? (e) => {
        const touch = e.changedTouches[0];
        if (touchStartX.current === null || !touch) return;
        const delta = touch.clientX - touchStartX.current;
        touchStartX.current = null;
        if (Math.abs(delta) < 60) return;
        const tabs: ColumnKey[] = ['assignment', 'todo', 'done'];
        const idx = tabs.indexOf(mobileTab);
        const next = delta < 0 ? tabs[idx + 1] : tabs[idx - 1];
        if (next) setMobileTab(next);
      } : undefined}
    >
      <div className="mx-auto px-3 py-4 sm:px-5 sm:py-8" style={{ maxWidth: 1400 }}>
        <div className="mb-5">
          <div className="flex flex-wrap items-center justify-end gap-4 mb-4">
            {!isMobile && (
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
            )}
          </div>

          {isMobile && (
            <div className="flex" style={{ background: '#F3F4F6', borderRadius: 10, padding: 4 }}>
              {TOGGLE_ORDER.map(key => {
                const count = key === 'assignment'
                  ? assignmentColumnItems.length
                  : key === 'todo'
                  ? todoColumnItems.length
                  : doneItems.length;
                const active = mobileTab === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setMobileTab(key)}
                    aria-pressed={active}
                    className="text-[13px] font-semibold"
                    style={{
                      flex: 1,
                      padding: '10px 4px',
                      borderRadius: 8,
                      border: 'none',
                      cursor: 'pointer',
                      background: active ? '#fff' : 'transparent',
                      color: active ? 'var(--c-text-1)' : 'var(--c-text-3)',
                      boxShadow: active ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                      transition: 'background 0.15s, color 0.15s, box-shadow 0.15s',
                    }}
                  >
                    {columnLabels[key]}
                    {count > 0 && (
                      <span className="ml-1 text-[11px]" style={{ opacity: 0.65 }}>{count}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
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
              isMobile={isMobile}
              visibleOrder={mobileVisibleOrder}
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
              onMoveAssignmentToTodo={handleMoveAssignmentToTodo}
              onMoveAssignmentToDone={handleMoveAssignmentToDone}
              onMoveTodoAssignmentToAssignment={handleMoveTodoAssignmentToAssignment}
              onMoveTodoToDone={handleMoveTodoToDone}
              onMoveDoneAssignmentToAssignment={handleMoveDoneAssignmentToAssignment}
              onMoveDoneAssignmentToTodo={handleMoveDoneAssignmentToTodo}
              onMoveDoneTodoToTodo={handleMoveDoneTodoToTodo}
            />

            <DragOverlay
              dropAnimation={null}
              modifiers={[snapToPointerModifier]}
            >
              {overlayLabel && (
                <div style={{ transform: 'scale(1.05) rotate(-0.5deg)', transition: 'none' }}>
                  <div
                    className="text-[13px] font-semibold"
                    style={{
                      padding: '9px 14px',
                      background: '#fff',
                      border: '1.5px solid var(--c-accent)',
                      borderRadius: 10,
                      boxShadow: '0 16px 40px rgba(0,0,0,0.22), 0 4px 12px rgba(0,0,0,0.10)',
                      maxWidth: 280,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: 'var(--c-text-1)',
                    }}
                  >
                    {overlayLabel}
                  </div>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}
      </div>
    </div>
  );
}
