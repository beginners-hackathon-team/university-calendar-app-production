import { useEffect, useRef, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Assignment, Todo } from '../../api/tasks';
import { buildAssignmentHref, getDeadlineMeta } from '../../lib/tasksBoard';
import { ColumnHeader, ColumnShell, DeadlinePill, EmptyState, TinyPill } from './ui';
import TodoBlockEditor, { type CaretPos } from './TodoBlockEditor';

type Props = {
  todos: Todo[];
  mirroredAssignments: Assignment[];
  systemTypes: Record<string, string | null>;
  busyKeys: Set<string>;
  setNodeRef: (node: HTMLElement | null) => void;
  style?: React.CSSProperties;
  gripRef: (node: HTMLElement | null) => void;
  gripProps: Record<string, unknown>;
  highlighted: boolean;
  onChangeTitle: (id: string, title: string) => void;
  onCreateBelow: (afterId: string | null) => Promise<string | undefined>;
  onDeleteTodo: (id: string) => void;
  onReturnAssignment: (id: string) => void;
};

export default function TodoColumn({
  todos,
  mirroredAssignments,
  systemTypes,
  busyKeys,
  setNodeRef,
  style,
  gripRef,
  gripProps,
  highlighted,
  onChangeTitle,
  onCreateBelow,
  onDeleteTodo,
  onReturnAssignment,
}: Props) {
  const [focusTarget, setFocusTarget] = useState<{ id: string; caret: CaretPos } | null>(null);

  const handleCreateBelow = async (afterId: string | null) => {
    const newId = await onCreateBelow(afterId);
    if (newId) setFocusTarget({ id: newId, caret: 'end' });
  };

  // 画面を開いたら、すぐ入力できるよう先頭TODOにカーソルを入れる（無ければ1つ作る）。
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    const first = todos[0];
    if (first) setFocusTarget({ id: first.id, caret: 'end' });
    else void handleCreateBelow(null);
    // 初回マウント時のみ。
  }, []);

  const handleDeleteBlock = (id: string, focusPrev: boolean) => {
    if (focusPrev) {
      const index = todos.findIndex(t => t.id === id);
      const prev = index > 0 ? todos[index - 1] : null;
      if (prev) setFocusTarget({ id: prev.id, caret: 'end' });
    }
    onDeleteTodo(id);
  };

  const handleNavigate = (id: string, dir: 'prev' | 'next') => {
    const index = todos.findIndex(t => t.id === id);
    const target = dir === 'prev' ? todos[index - 1] : todos[index + 1];
    if (target) setFocusTarget({ id: target.id, caret: dir === 'prev' ? 'end' : 'start' });
  };

  return (
    <ColumnShell setNodeRef={setNodeRef} style={style} highlighted={highlighted}>
      <ColumnHeader
        title="TODO"
        count={todos.length}
        gripRef={gripRef}
        gripProps={gripProps}
        right={
          <button
            type="button"
            onClick={() => void handleCreateBelow(null)}
            className="text-[12px] font-semibold"
            style={{
              padding: '5px 11px',
              borderRadius: 8,
              border: '1px solid transparent',
              background: 'var(--c-accent-bg)',
              color: 'var(--c-accent)',
              cursor: 'pointer',
            }}
          >
            ＋追加
          </button>
        }
      />

      <div style={{ overflowY: 'auto', flex: 1 }}>
        {mirroredAssignments.length > 0 && (
          <div style={{ background: '#FCFCFD', borderBottom: '1px solid var(--c-border)' }}>
            <div className="text-[11px] font-bold" style={{ padding: '9px 14px 4px', color: 'var(--c-text-3)' }}>
              課題
            </div>
            {mirroredAssignments.map(a => (
              <MirroredAssignmentCard
                key={a.id}
                assignment={a}
                systemTypes={systemTypes}
                onReturn={() => onReturnAssignment(a.id)}
              />
            ))}
          </div>
        )}

        {todos.length === 0 ? (
          <EmptyState label="＋追加 か Enter で TODO を作成" />
        ) : (
          <SortableContext items={todos.map(t => `todo:${t.id}`)} strategy={verticalListSortingStrategy}>
            <div style={{ padding: '6px 0' }}>
              {todos.map(todo => (
                <TodoBlockEditor
                  key={todo.id}
                  todo={todo}
                  busy={busyKeys.has(`todo-delete-${todo.id}`)}
                  autoFocus={focusTarget?.id === todo.id}
                  caret={focusTarget?.id === todo.id ? focusTarget.caret : 'end'}
                  onConsumeFocus={() => setFocusTarget(null)}
                  onChangeTitle={onChangeTitle}
                  onCreateBelow={id => void handleCreateBelow(id)}
                  onDeleteBlock={handleDeleteBlock}
                  onNavigate={handleNavigate}
                />
              ))}
            </div>
          </SortableContext>
        )}
      </div>
    </ColumnShell>
  );
}

// TODO カラムへ移動した課題（データは課題のまま・ドラッグ可能・課題に戻せる）。
function MirroredAssignmentCard({
  assignment,
  systemTypes,
  onReturn,
}: {
  assignment: Assignment;
  systemTypes: Record<string, string | null>;
  onReturn: () => void;
}) {
  // 課題カラムのカードと id が衝突しないよう、複製カードは別 id にする（data は同じ）。
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `mirror-assignment:${assignment.id}`,
    data: { type: 'assignment', id: assignment.id },
  });
  const lmsHref = buildAssignmentHref(assignment, systemTypes);

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        gap: 8,
        alignItems: 'center',
        padding: '10px 14px',
        borderBottom: '1px solid #F3F4F6',
        cursor: 'grab',
        opacity: isDragging ? 0.5 : 1,
        touchAction: 'none',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div className="flex items-center gap-2 mb-1" style={{ flexWrap: 'wrap' }}>
          <TinyPill>課題</TinyPill>
          <DeadlinePill meta={getDeadlineMeta(assignment.availability_end)} />
        </div>
        <div className="text-[13px] font-semibold" style={{ color: 'var(--c-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {assignment.task_name}
        </div>
        {lmsHref && (
          <a
            href={lmsHref}
            target="webclass"
            rel="noopener noreferrer"
            onPointerDown={e => e.stopPropagation()}
            className="text-[12px] font-semibold"
            style={{ color: 'var(--c-accent)', textDecoration: 'none' }}
          >
            {assignment.course_name ?? 'LMSで開く'}
          </a>
        )}
      </div>
      <button
        type="button"
        onClick={onReturn}
        onPointerDown={e => e.stopPropagation()}
        className="text-[11px] font-semibold"
        title="課題に戻す"
        style={{
          padding: '4px 8px',
          borderRadius: 7,
          border: '1px solid var(--c-border)',
          background: '#fff',
          color: 'var(--c-text-2)',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        ← 課題
      </button>
    </div>
  );
}
