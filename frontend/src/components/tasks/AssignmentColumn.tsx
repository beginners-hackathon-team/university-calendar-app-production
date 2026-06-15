import { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import {
  useFloating,
  useHover,
  useInteractions,
  useDismiss,
  useRole,
  offset,
  flip,
  shift,
  autoUpdate,
  FloatingPortal,
} from '@floating-ui/react';
import type { Assignment } from '../../api/tasks';
import {
  type AssignmentSortMode,
  assignmentSortOptions,
  buildAssignmentHref,
  formatDateTime,
  getDeadlineMeta,
  groupAssignmentsByCourse,
  sortAssignments,
} from '../../lib/tasksBoard';
import { ColumnHeader, ColumnShell, DeadlinePill, EmptyState, TinyPill } from './ui';

type Props = {
  assignments: Assignment[];
  sortMode: AssignmentSortMode;
  systemTypes: Record<string, string | null>;
  setNodeRef: (node: HTMLElement | null) => void;
  style?: React.CSSProperties;
  gripRef: (node: HTMLElement | null) => void;
  gripProps: Record<string, unknown>;
  highlighted: boolean;
  onSortModeChange: (mode: AssignmentSortMode) => void;
};

export default function AssignmentColumn({
  assignments,
  sortMode,
  systemTypes,
  setNodeRef,
  style,
  gripRef,
  gripProps,
  highlighted,
  onSortModeChange,
}: Props) {
  const sorted = sortMode === 'course' ? null : sortAssignments(assignments, 'deadline-asc');
  const groups = sortMode === 'course' ? groupAssignmentsByCourse(assignments) : null;

  return (
    <ColumnShell setNodeRef={setNodeRef} style={style} highlighted={highlighted}>
      <ColumnHeader
        title="課題"
        count={assignments.length}
        gripRef={gripRef}
        gripProps={gripProps}
        right={
          <select
            value={sortMode}
            onChange={e => onSortModeChange(e.target.value as AssignmentSortMode)}
            aria-label="課題の並び"
            className="ku-input text-[12px] font-medium"
            style={{
              padding: '5px 8px',
              borderRadius: 'var(--r-input)',
              border: '1.5px solid var(--c-border)',
              color: 'var(--c-text-1)',
              background: '#fff',
              cursor: 'pointer',
            }}
          >
            {assignmentSortOptions.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        }
      />

      <div style={{ overflowY: 'auto', flex: 1 }}>
        {assignments.length === 0 ? (
          <EmptyState label="未完了の課題はありません" />
        ) : groups ? (
          groups.map(group => (
            <div key={group.label}>
              <div
                className="text-[11px] font-bold flex items-center justify-between gap-3"
                style={{ padding: '10px 14px 5px', color: 'var(--c-text-3)' }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{group.label}</span>
                <span style={{ flexShrink: 0 }}>{group.items.length}</span>
              </div>
              {group.items.map(a => (
                <AssignmentCard key={a.id} assignment={a} systemTypes={systemTypes} />
              ))}
            </div>
          ))
        ) : (
          sorted!.map(a => <AssignmentCard key={a.id} assignment={a} systemTypes={systemTypes} />)
        )}
      </div>
    </ColumnShell>
  );
}

function AssignmentCard({
  assignment,
  systemTypes,
}: {
  assignment: Assignment;
  systemTypes: Record<string, string | null>;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `assignment:${assignment.id}`,
    data: { type: 'assignment', id: assignment.id },
  });

  const [open, setOpen] = useState(false);
  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: 'right-start',
    middleware: [offset(8), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });
  // カーソルを 0.5 秒合わせると詳細を表示する。
  const hover = useHover(context, { delay: { open: 500, close: 0 }, move: false });
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: 'tooltip' });
  const { getReferenceProps, getFloatingProps } = useInteractions([hover, dismiss, role]);

  const lmsHref = buildAssignmentHref(assignment, systemTypes);
  const deadlineMeta = getDeadlineMeta(assignment.availability_end);

  const setRefs = (node: HTMLElement | null) => {
    setNodeRef(node);
    refs.setReference(node);
  };

  return (
    <>
      <div
        ref={setRefs}
        {...attributes}
        {...getReferenceProps()}
        {...listeners}
        style={{
          padding: '12px 14px',
          borderBottom: '1px solid var(--c-border)',
          cursor: 'grab',
          opacity: isDragging ? 0.5 : 1,
          touchAction: 'none',
          background: '#fff',
        }}
      >
        <div className="flex items-center gap-2 mb-1.5" style={{ minWidth: 0, flexWrap: 'wrap' }}>
          <DeadlinePill meta={deadlineMeta} />
          {assignment.kind && <TinyPill muted>{assignment.kind}</TinyPill>}
        </div>
        <div
          className="text-[13.5px] font-semibold"
          style={{
            color: 'var(--c-text-1)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {assignment.task_name}
        </div>
        <div className="text-[12px] mt-1" style={{ minWidth: 0 }}>
          {lmsHref ? (
            <a
              href={lmsHref}
              target="webclass"
              rel="noopener noreferrer"
              onPointerDown={e => e.stopPropagation()}
              className="font-semibold"
              style={{ color: 'var(--c-accent)', textDecoration: 'none' }}
            >
              {assignment.course_name ?? 'LMSで開く'}
            </a>
          ) : (
            <span style={{ color: 'var(--c-text-3)' }}>{assignment.course_name ?? '授業未設定'}</span>
          )}
        </div>
      </div>

      {open && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={{
              ...floatingStyles,
              zIndex: 2000,
              width: 280,
              background: '#fff',
              border: '1px solid var(--c-border)',
              borderRadius: 12,
              boxShadow: '0 8px 28px rgba(0,0,0,0.14)',
              padding: 14,
            }}
            {...getFloatingProps()}
          >
            <div className="text-[13px] font-bold mb-2" style={{ color: 'var(--c-text-1)', overflowWrap: 'anywhere' }}>
              {assignment.task_name}
            </div>
            <DetailRow label="授業" value={assignment.course_name ?? '未設定'} />
            <DetailRow label="期限" value={formatDateTime(assignment.availability_end) ?? assignment.availability_end ?? '期限なし'} />
            <DetailRow label="公開" value={formatDateTime(assignment.availability_start) ?? assignment.availability_start ?? '未設定'} />
            <DetailRow label="提出" value={assignment.submitted_at ?? '未提出'} />
            <DetailRow label="結果" value={assignment.result || '未設定'} />
            <DetailRow label="点数" value={assignment.score ?? '未設定'} />
          </div>
        </FloatingPortal>
      )}
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="grid gap-3 text-[12.5px]"
      style={{ gridTemplateColumns: '52px minmax(0, 1fr)', padding: '6px 0', borderBottom: '1px solid #F1F3F6' }}
    >
      <div className="font-semibold" style={{ color: 'var(--c-text-3)' }}>{label}</div>
      <div style={{ minWidth: 0, overflowWrap: 'anywhere', color: 'var(--c-text-2)' }}>{value}</div>
    </div>
  );
}
