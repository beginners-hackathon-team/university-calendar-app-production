import { useDraggable } from '@dnd-kit/core';
import { type DoneItem, buildAssignmentHref, formatDateTime } from '../../lib/tasksBoard';
import { ColumnHeader, ColumnShell, EmptyState, TextDangerButton, TinyPill } from './ui';

type Props = {
  items: DoneItem[];
  systemTypes: Record<string, string | null>;
  busyKeys: Set<string>;
  setNodeRef: (node: HTMLElement | null) => void;
  style?: React.CSSProperties;
  gripRef: (node: HTMLElement | null) => void;
  gripProps: Record<string, unknown>;
  highlighted: boolean;
  onDeleteTodo: (id: string) => void;
  onDeleteAssignment: (id: string) => void;
};

export default function DoneColumn({
  items,
  systemTypes,
  busyKeys,
  setNodeRef,
  style,
  gripRef,
  gripProps,
  highlighted,
  onDeleteTodo,
  onDeleteAssignment,
}: Props) {
  return (
    <ColumnShell setNodeRef={setNodeRef} style={style} highlighted={highlighted}>
      <ColumnHeader title="完了" count={items.length} gripRef={gripRef} gripProps={gripProps} />

      <div>
        <div className="text-[11px]" style={{ padding: '8px 14px', color: 'var(--c-text-3)', borderBottom: '1px solid #F1F3F6' }}>
          完了から1週間で自動的に消えます。TODOはドラッグで戻せます。
        </div>
        {items.length === 0 ? (
          <EmptyState label="完了したタスクはありません" />
        ) : (
          items.map(item => (
            <DoneCard
              key={`${item.kind}:${item.data.id}`}
              item={item}
              systemTypes={systemTypes}
              busy={
                item.kind === 'todo'
                  ? busyKeys.has(`todo-toggle-${item.data.id}`) || busyKeys.has(`todo-delete-${item.data.id}`)
                  : busyKeys.has(`assignment-delete-${item.data.id}`)
              }
              onDelete={() => (item.kind === 'todo' ? onDeleteTodo(item.data.id) : onDeleteAssignment(item.data.id))}
            />
          ))
        )}
      </div>
    </ColumnShell>
  );
}

function DoneCard({
  item,
  systemTypes,
  busy,
  onDelete,
}: {
  item: DoneItem;
  systemTypes: Record<string, string | null>;
  busy: boolean;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `done:${item.kind}:${item.data.id}`,
    data: { type: 'done', column: 'done', doneKind: item.kind, id: item.data.id },
  });

  const title = item.kind === 'assignment' ? item.data.task_name : item.data.title;
  const lmsHref = item.kind === 'assignment' ? buildAssignmentHref(item.data, systemTypes) : undefined;

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        gap: 10,
        alignItems: 'center',
        padding: '11px 14px',
        borderBottom: '1px solid #F1F3F6',
        cursor: 'grab',
        opacity: isDragging ? 0.5 : 1,
        touchAction: 'none',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div className="flex items-center gap-2 mb-1">
          <TinyPill muted>{item.kind === 'assignment' ? '課題' : 'TODO'}</TinyPill>
          <span className="text-[11px]" style={{ color: 'var(--c-text-3)' }}>
            {formatDateTime(item.data.done_at) ?? '完了'}
          </span>
        </div>
        <div
          className="text-[13px] font-semibold"
          style={{ color: 'var(--c-text-3)', textDecoration: 'line-through', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {title}
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
            LMS
          </a>
        )}
      </div>
      <TextDangerButton disabled={busy} onClick={onDelete}>削除</TextDangerButton>
    </div>
  );
}
