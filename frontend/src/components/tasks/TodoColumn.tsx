import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Todo } from '../../api/tasks';
import { type TodoColumnItem, type TodoViewMode, todoColumnItemKey } from '../../lib/tasksBoard';
import { ColumnHeader, ColumnShell, EmptyState, GhostCard } from './ui';
import TodoBlock, { type AssignmentFocusField, type CaretPos } from './TodoBlock';

type Props = {
  items: TodoColumnItem[];
  viewMode: TodoViewMode;
  systemTypes: Record<string, string | null>;
  busyKeys: Set<string>;
  isMobile?: boolean;
  setNodeRef: (node: HTMLElement | null) => void;
  style?: React.CSSProperties;
  gripRef: (node: HTMLElement | null) => void;
  gripProps: Record<string, unknown>;
  highlighted: boolean;
  ghostBeforeKey?: string | null;
  activeDragLabel?: string | null;
  onViewModeChange: (mode: TodoViewMode) => void;
  onChangeTitle: (id: string, title: string) => void;
  onChangeAssignmentTitle: (id: string, taskName: string) => void;
  onCreateTodo: (title: string) => void;
  onCreateTodoBelow: (afterId: string | null) => string;
  onCreateTodoBefore: (beforeId: string) => string;
  onDeleteTodo: (id: string) => void;
  onMoveAssignmentToAssignment: (id: string) => void;
  onMoveAssignmentToDone: (id: string) => void;
  onMoveTodoToDone: (id: string) => void;
};

// TODOカラム。テキストモードは「エディタ」、リストモードは同じブロックを見やすく
// 強調しただけの状態として扱う（別UIにはしない）。1つの Todo / 課題 は常に同じ
// TodoBlock コンポーネントで描画し、variant で chrome の強さと行番号表示だけを切り替える。
export default memo(function TodoColumn({
  items,
  viewMode,
  systemTypes,
  busyKeys,
  isMobile,
  setNodeRef,
  style,
  gripRef,
  gripProps,
  highlighted,
  ghostBeforeKey,
  activeDragLabel,
  onViewModeChange,
  onChangeTitle,
  onChangeAssignmentTitle,
  onCreateTodo,
  onCreateTodoBelow,
  onCreateTodoBefore,
  onDeleteTodo,
  onMoveAssignmentToAssignment,
  onMoveAssignmentToDone,
  onMoveTodoToDone,
}: Props) {
  const [focusTarget, setFocusTarget] = useState<{ id: string; caret: CaretPos; field?: AssignmentFocusField } | null>(null);
  // 矢印キー/Enter/Backspaceなどでブロック間を「内部的に」移動している間は true。
  // ブロックのblurがこの移動によるものか、フォーカスが編集領域の外へ出て行くものかを
  // 区別するために使う（末尾ブロックの自動確保が誤って過剰発火するのを防ぐ）。
  const internalFocusMoveRef = useRef(false);

  // ブロック作成・削除のフォーカス移譲は Todo 同士の並びだけを対象にする（課題ブロックは作成/削除できないため）。
  const todoItems = useMemo(
    () => items.filter((item): item is { type: 'todo'; todo: Todo } => item.type === 'todo').map(item => item.todo),
    [items],
  );
  const todoItemsRef = useRef(todoItems);
  todoItemsRef.current = todoItems;

  const handleCreateBelow = useCallback((afterId: string | null) => {
    const newId = onCreateTodoBelow(afterId);
    console.log('[DEBUG] handleCreateBelow: afterId=%s -> newId=%s, internalFocusMoveRef=true', afterId, newId);
    internalFocusMoveRef.current = true;
    setFocusTarget({ id: newId, caret: 'end' });
  }, [onCreateTodoBelow]);

  // 課題ブロックの授業名行でEnterしたときなど、指定したブロックの直前に新しいTodoを作る。
  const handleCreateBefore = useCallback((beforeId: string) => {
    const newId = onCreateTodoBefore(beforeId);
    console.log('[DEBUG] handleCreateBefore: beforeId=%s -> newId=%s, internalFocusMoveRef=true', beforeId, newId);
    internalFocusMoveRef.current = true;
    setFocusTarget({ id: newId, caret: 'end' });
  }, [onCreateTodoBefore]);

  const handleDeleteBlock = useCallback((id: string, focusPrev: boolean) => {
    if (focusPrev) {
      const index = todoItemsRef.current.findIndex(t => t.id === id);
      const prev = index > 0 ? todoItemsRef.current[index - 1] : null;
      if (prev) {
        console.log('[DEBUG] handleDeleteBlock: id=%s -> focus prev id=%s, internalFocusMoveRef=true', id, prev.id);
        internalFocusMoveRef.current = true;
        setFocusTarget({ id: prev.id, caret: 'end' });
      }
    }
    onDeleteTodo(id);
  }, [onDeleteTodo]);

  // 表示フィルタ。データ（items / todoColumnOrder）自体は変更しない。
  // リストモード: 「そのまま書き続けられる」ための空Todo（テキストモード用の空行）は表示しない。
  // テキストモードに戻すと、items 自体は変わっていないのでそのまま復元される。
  const renderItems = useMemo(() => {
    if (viewMode === 'text') return items;
    return items.filter(item => item.type !== 'todo' || item.todo.title.trim() !== '');
  }, [items, viewMode]);
  const renderItemsRef = useRef(renderItems);
  renderItemsRef.current = renderItems;
  const itemKeys = useMemo(() => renderItems.map(todoColumnItemKey), [renderItems]);

  // ヘッダーの件数表示。テキストモード用の空プレースホルダーは数えない。
  const meaningfulCount = useMemo(
    () => items.filter(item => item.type !== 'todo' || item.todo.title.trim() !== '').length,
    [items],
  );

  // ↑↓キーでのブロック間移動は、表示中の全ブロック（Todo・課題どちらも）を対象にする。
  // 課題ブロックへ移動した場合、表示順に沿って自然に見えるよう、下方向で入るときは授業名、
  // 上方向で入るときは期限に着地する（課題タイトルへ直接着地させたい場合だけ field を省略する）。
  const handleNavigate = useCallback((id: string, dir: 'prev' | 'next') => {
    const current = renderItemsRef.current;
    const index = current.findIndex(it => (it.type === 'todo' ? it.todo.id : it.assignment.id) === id);
    if (index < 0) return;
    const target = dir === 'prev' ? current[index - 1] : current[index + 1];
    if (!target) return;
    const targetId = target.type === 'todo' ? target.todo.id : target.assignment.id;
    const field: AssignmentFocusField | undefined = target.type === 'assignment' ? (dir === 'prev' ? 'deadline' : 'course') : undefined;
    console.log('[DEBUG] handleNavigate: from id=%s dir=%s -> target id=%s, internalFocusMoveRef=true', id, dir, targetId);
    internalFocusMoveRef.current = true;
    setFocusTarget({ id: targetId, caret: dir === 'prev' ? 'end' : 'start', field });
  }, []);

  // テキストモードを開いたら、すぐ入力できるよう先頭ブロックにカーソルを入れる（初回のみ）。
  const didInit = useRef(false);
  useEffect(() => {
    if (viewMode !== 'text' || didInit.current) return;
    const first = todoItems[0];
    if (!first) return; // 下の「最低1つ確保する」エフェクトが作成し、それ自身でフォーカスする。
    didInit.current = true;
    setFocusTarget({ id: first.id, caret: 'end' });
  }, [viewMode, todoItems]); // eslint-disable-line react-hooks/exhaustive-deps

  // テキストモードに Todo が1つも無ければ、空のブロックを1つ確保する。
  // 件数（todoItems.length）だけを依存にすることで、入力中の文字変更では再発火しない。
  // ensuringEmptyBlockRef は StrictMode の effect 二重実行などで作成が重複しないようにするための
  // 同期的なガード（todoItems.length はレンダーが確定するまで更新されないため、それだけでは防げない）。
  const ensuringEmptyBlockRef = useRef(false);
  useEffect(() => {
    if (viewMode !== 'text') return;
    if (todoItems.length > 0) {
      ensuringEmptyBlockRef.current = false;
      return;
    }
    if (ensuringEmptyBlockRef.current) return;
    ensuringEmptyBlockRef.current = true;
    handleCreateBelow(null);
  }, [viewMode, todoItems.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // テキストモードでは「そのまま書き続けられる」ように、末尾のブロックに入力して確定（blur）したら
  // 新しい空ブロックを末尾に追加する。フォーカスは奪わない（クリックして離れた先を優先する）。
  const ensureTrailingEmptyBlock = useCallback((id: string) => {
    const last = renderItemsRef.current[renderItemsRef.current.length - 1];
    const isActuallyLast = last?.type === 'todo' && last.todo.id === id;
    console.log('[DEBUG] ensureTrailingEmptyBlock called: id=%s, computedLastId=%s, isActuallyLast=%s', id, last?.type === 'todo' ? last.todo.id : last?.type, isActuallyLast);
    if (isActuallyLast) {
      onCreateTodoBelow(id);
    }
  }, [onCreateTodoBelow]);

  const emptyLabel = viewMode === 'list' ? '上のフォームから TODO を追加' : 'Enter で TODO を作成';

  return (
    <ColumnShell setNodeRef={setNodeRef} style={style} highlighted={highlighted}>
      <ColumnHeader
        title="TODO"
        count={meaningfulCount}
        gripRef={gripRef}
        gripProps={gripProps}
        right={<ViewModeToggle mode={viewMode} onChange={onViewModeChange} />}
      />

      {viewMode === 'list' && <TodoCreateForm onCreate={onCreateTodo} />}

      <div>
        {renderItems.length === 0 ? (
          ghostBeforeKey !== undefined
            ? <GhostCard label={activeDragLabel ?? null} />
            : <EmptyState label={emptyLabel} />
        ) : (
          <SortableContext items={itemKeys} strategy={verticalListSortingStrategy}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                // テキストモードはブロック間の余白を持たせず、1つのエディタに連続したテキストが
                // 並んでいるように見せる（区切りは空行のみで表現する）。
                gap: viewMode === 'text' ? 0 : 6,
                padding: viewMode === 'text' ? '8px 10px' : '10px 8px',
              }}
            >
              {renderItems.map((item, index) => {
                const itemKey = todoColumnItemKey(item);
                const id = item.type === 'todo' ? item.todo.id : item.assignment.id;
                const isLast = viewMode === 'text' && index === renderItems.length - 1;
                return (
                  <Fragment key={itemKey}>
                    {ghostBeforeKey === itemKey && <GhostCard label={activeDragLabel ?? null} />}
                    <TodoBlock
                      item={item}
                      variant={viewMode}
                      lineNumber={viewMode === 'text' ? index + 1 : undefined}
                      isLast={isLast}
                      systemTypes={systemTypes}
                      isMobile={isMobile}
                      busy={busyKeys.has(`todo-delete-${id}`)}
                      autoFocus={focusTarget?.id === id}
                      caret={focusTarget?.id === id ? focusTarget.caret : 'end'}
                      focusField={focusTarget?.id === id ? focusTarget.field : undefined}
                      onConsumeFocus={() => { console.log('[DEBUG] onConsumeFocus: id=%s, internalFocusMoveRef=false', id); setFocusTarget(null); internalFocusMoveRef.current = false; }}
                      internalFocusMoveRef={internalFocusMoveRef}
                      onChangeTitle={onChangeTitle}
                      onChangeAssignmentTitle={onChangeAssignmentTitle}
                      onCreateBelow={handleCreateBelow}
                      onCreateBefore={handleCreateBefore}
                      onDeleteBlock={handleDeleteBlock}
                      onNavigate={handleNavigate}
                      onEnsureTrailingBlock={ensureTrailingEmptyBlock}
                      onMoveAssignmentToAssignment={viewMode === 'list' && item.type === 'assignment' ? () => onMoveAssignmentToAssignment(item.assignment.id) : undefined}
                      onMoveAssignmentToDone={viewMode === 'list' && item.type === 'assignment' ? () => onMoveAssignmentToDone(item.assignment.id) : undefined}
                      onMoveTodoToDone={viewMode === 'list' && item.type === 'todo' ? () => onMoveTodoToDone(item.todo.id) : undefined}
                    />
                  </Fragment>
                );
              })}
              {ghostBeforeKey === null && <GhostCard label={activeDragLabel ?? null} />}
            </div>
          </SortableContext>
        )}
      </div>
    </ColumnShell>
  );
});

function ViewModeToggle({ mode, onChange }: { mode: TodoViewMode; onChange: (mode: TodoViewMode) => void }) {
  const options: { value: TodoViewMode; label: string }[] = [
    { value: 'list', label: 'リスト' },
    { value: 'text', label: 'テキスト' },
  ];
  return (
    <div className="flex gap-0.5" style={{ background: '#F3F4F6', borderRadius: 8, padding: 2 }}>
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={mode === option.value}
          className="text-[11px] font-semibold"
          style={{
            padding: '4px 9px',
            borderRadius: 6,
            border: 'none',
            cursor: 'pointer',
            background: mode === option.value ? '#fff' : 'transparent',
            color: mode === option.value ? 'var(--c-text-1)' : 'var(--c-text-3)',
            boxShadow: mode === option.value ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

// リストモード上部の TODO 作成フォーム。
function TodoCreateForm({ onCreate }: { onCreate: (title: string) => void }) {
  const [value, setValue] = useState('');

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setValue('');
    onCreate(trimmed);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        submit();
      }}
      style={{ display: 'flex', gap: 8, padding: '10px 14px', borderBottom: '1px solid var(--c-border)', background: '#FAFBFC' }}
    >
      <textarea
        value={value}
        rows={1}
        placeholder="TODO を入力してEnter"
        onChange={e => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        className="text-[13.5px]"
        style={{
          flex: 1,
          resize: 'none',
          border: '1.5px solid var(--c-border)',
          borderRadius: 8,
          outline: 'none',
          padding: '6px 9px',
          fontFamily: 'inherit',
          lineHeight: 1.5,
          color: 'var(--c-text-1)',
        }}
      />
      <button
        type="submit"
        className="text-[12px] font-semibold"
        style={{
          padding: '6px 12px',
          borderRadius: 8,
          border: '1px solid transparent',
          background: 'var(--c-accent-bg)',
          color: 'var(--c-accent)',
          cursor: 'pointer',
          alignSelf: 'flex-start',
        }}
      >
        追加
      </button>
    </form>
  );
}
