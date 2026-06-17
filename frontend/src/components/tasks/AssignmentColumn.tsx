import { useDraggable } from '@dnd-kit/core';
import type { Assignment } from '../../api/tasks';
import {
  type AssignmentSortMode,
  assignmentSortOptions,
  groupAssignmentsByCourse,
  sortAssignments,
} from '../../lib/tasksBoard';
import { ColumnHeader, ColumnShell, EmptyState } from './ui';
import AssignmentTaskCard from './AssignmentTaskCard';

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

      <div>
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
                <DraggableAssignmentCard key={a.id} assignment={a} systemTypes={systemTypes} />
              ))}
            </div>
          ))
        ) : (
          sorted!.map(a => <DraggableAssignmentCard key={a.id} assignment={a} systemTypes={systemTypes} />)
        )}
      </div>
    </ColumnShell>
  );
}

function DraggableAssignmentCard({
  assignment,
  systemTypes,
}: {
  assignment: Assignment;
  systemTypes: Record<string, string | null>;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `assignment:${assignment.id}`,
    data: { type: 'assignment', column: 'assignment', id: assignment.id },
  });

  return (
    <AssignmentTaskCard
      assignment={assignment}
      systemTypes={systemTypes}
      setNodeRef={setNodeRef}
      dragAttributes={attributes}
      dragListeners={listeners}
      isDragging={isDragging}
      style={{ borderBottom: '1px solid var(--c-border)' }}
    />
  );
}
