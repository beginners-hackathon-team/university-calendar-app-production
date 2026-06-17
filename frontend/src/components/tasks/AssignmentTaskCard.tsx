import { useState, type CSSProperties } from 'react';
import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core';
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
import { buildAssignmentHref, formatCourseName, formatDateTime, formatRemainingDeadline } from '../../lib/tasksBoard';

// 課題カラム・TODOリストモードで共通利用する課題カード。
// 表示は 授業名 / 課題名 / 残り期限 の3項目に絞り、ホバーで詳細を確認できる。
type Props = {
  assignment: Assignment;
  systemTypes: Record<string, string | null>;
  setNodeRef?: (node: HTMLElement | null) => void;
  style?: CSSProperties;
  dragAttributes?: DraggableAttributes;
  dragListeners?: DraggableSyntheticListeners;
  isDragging?: boolean;
};

export default function AssignmentTaskCard({
  assignment,
  systemTypes,
  setNodeRef,
  style,
  dragAttributes,
  dragListeners,
  isDragging,
}: Props) {
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
  const deadline = formatRemainingDeadline(assignment.availability_end);
  const courseName = formatCourseName(assignment.course_name);

  const setRefs = (node: HTMLElement | null) => {
    setNodeRef?.(node);
    refs.setReference(node);
  };

  return (
    <>
      <div
        ref={setRefs}
        {...dragAttributes}
        {...getReferenceProps()}
        {...dragListeners}
        style={{
          padding: '12px 14px',
          cursor: 'grab',
          opacity: isDragging ? 0.5 : 1,
          touchAction: 'none',
          background: '#fff',
          ...style,
        }}
      >
        <div className="text-[12px]" style={{ minWidth: 0, marginBottom: 3 }}>
          {lmsHref ? (
            <a
              href={lmsHref}
              target="webclass"
              rel="noopener noreferrer"
              onPointerDown={e => e.stopPropagation()}
              className="font-semibold"
              style={{ color: 'var(--c-accent)', textDecoration: 'none' }}
            >
              {courseName || 'LMSで開く'}
            </a>
          ) : (
            <span style={{ color: 'var(--c-text-3)' }}>{courseName || '授業未設定'}</span>
          )}
        </div>
        <div
          className="text-[13.5px] font-semibold"
          style={{
            color: 'var(--c-text-1)',
            lineHeight: 1.4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            marginBottom: 4,
          }}
        >
          {assignment.task_name}
        </div>
        <div className="text-[12px] font-bold" style={{ color: deadline.color }}>
          {deadline.label}
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
