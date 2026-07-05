import { Fragment } from 'react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Assignment } from '../../api/tasks';
import {
  type AssignmentSortMode,
  type AssignmentFilterMode,
  assignmentSortOptions,
  groupAssignmentsByCourse,
} from '../../lib/tasksBoard';
import { ColumnHeader, ColumnShell, EmptyState, GhostCard } from './ui';
import { SortableAssignmentCard, DraggableAssignmentCard } from './AssignmentCard';

type Props = {
  assignments: Assignment[];
  sortMode: AssignmentSortMode;
  filterMode: AssignmentFilterMode;
  systemTypes: Record<string, string | null>;
  isMobile?: boolean;
  setNodeRef: (node: HTMLElement | null) => void;
  style?: React.CSSProperties;
  gripRef: (node: HTMLElement | null) => void;
  gripProps: Record<string, unknown>;
  highlighted: boolean;
  ghostBeforeKey?: string | null;
  activeDragLabel?: string | null;
  onSortModeChange: (mode: AssignmentSortMode) => void;
  onFilterModeChange: (mode: AssignmentFilterMode) => void;
  onChangeTitle: (id: string, taskName: string) => void;
  onMoveToTodo: (id: string) => void;
  onMoveToDone: (id: string) => void;
};

export default function AssignmentColumn({
  assignments,
  sortMode,
  filterMode,
  systemTypes,
  isMobile,
  setNodeRef,
  style,
  gripRef,
  gripProps,
  highlighted,
  ghostBeforeKey,
  activeDragLabel,
  onSortModeChange,
  onFilterModeChange,
  onChangeTitle,
  onMoveToTodo,
  onMoveToDone,
}: Props) {
  const groups = sortMode === 'course' ? groupAssignmentsByCourse(assignments) : null;

  return (
    <ColumnShell setNodeRef={setNodeRef} style={style} highlighted={highlighted}>
      <ColumnHeader
        title="課題"
        count={assignments.length}
        gripRef={gripRef}
        gripProps={gripProps}
        right={
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* 期限フィルタ */}
            <div
              style={{
                display: 'flex',
                background: 'var(--c-bg-2, #F4F4F4)',
                borderRadius: 7,
                padding: 2,
                gap: 2,
              }}
            >
              {(['week', 'all'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => onFilterModeChange(mode)}
                  className="text-[11px] font-semibold"
                  style={{
                    padding: '3px 8px',
                    borderRadius: 5,
                    border: 'none',
                    cursor: 'pointer',
                    background: filterMode === mode ? '#fff' : 'transparent',
                    color: filterMode === mode ? 'var(--c-text-1)' : 'var(--c-text-3)',
                    boxShadow: filterMode === mode ? '0 1px 3px rgba(0,0,0,0.10)' : 'none',
                    transition: 'all 0.1s',
                  }}
                >
                  {mode === 'week' ? '1週間' : 'すべて'}
                </button>
              ))}
            </div>
            {/* 並び順 */}
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
          </div>
        }
      />

      <div style={{ padding: '6px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {assignments.length === 0 ? (
          ghostBeforeKey !== undefined
            ? <GhostCard label={activeDragLabel ?? null} />
            : <EmptyState label="未完了の課題はありません" />
        ) : groups ? (
          <>
            {groups.map(group => (
              <div key={group.label} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div
                  className="text-[11px] font-bold flex items-center justify-between gap-3"
                  style={{ padding: '6px 8px 3px', color: 'var(--c-text-3)' }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{group.label}</span>
                  <span style={{ flexShrink: 0 }}>{group.items.length}</span>
                </div>
                {group.items.map(a => (
                  <Fragment key={a.id}>
                    {ghostBeforeKey === `assignment:${a.id}` && <GhostCard label={activeDragLabel ?? null} />}
                    <DraggableAssignmentCard
                      assignment={a}
                      systemTypes={systemTypes}
                      isMobile={isMobile}
                      onChangeTitle={onChangeTitle}
                      onMoveToTodo={onMoveToTodo}
                      onMoveToDone={onMoveToDone}
                    />
                  </Fragment>
                ))}
              </div>
            ))}
            {ghostBeforeKey === null && <GhostCard label={activeDragLabel ?? null} />}
          </>
        ) : (
          <SortableContext
            items={assignments.map(a => `assignment:${a.id}`)}
            strategy={verticalListSortingStrategy}
          >
            {assignments.map(a => (
              <Fragment key={a.id}>
                {ghostBeforeKey === `assignment:${a.id}` && <GhostCard label={activeDragLabel ?? null} />}
                <SortableAssignmentCard
                  assignment={a}
                  systemTypes={systemTypes}
                  isMobile={isMobile}
                  onChangeTitle={onChangeTitle}
                  onMoveToTodo={onMoveToTodo}
                  onMoveToDone={onMoveToDone}
                />
              </Fragment>
            ))}
            {ghostBeforeKey === null && <GhostCard label={activeDragLabel ?? null} />}
          </SortableContext>
        )}
      </div>
    </ColumnShell>
  );
}
