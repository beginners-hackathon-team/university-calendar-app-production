import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Assignment } from '../../api/tasks';
import {
  type AssignmentSortMode,
  assignmentSortOptions,
  buildAssignmentHref,
  formatCourseName,
  formatRemainingDeadline,
  groupAssignmentsByCourse,
} from '../../lib/tasksBoard';
import { ColumnHeader, ColumnShell, EmptyState, getTextRowStyle } from './ui';

type Props = {
  assignments: Assignment[];
  sortMode: AssignmentSortMode;
  systemTypes: Record<string, string | null>;
  isMobile?: boolean;
  setNodeRef: (node: HTMLElement | null) => void;
  style?: React.CSSProperties;
  gripRef: (node: HTMLElement | null) => void;
  gripProps: Record<string, unknown>;
  highlighted: boolean;
  onSortModeChange: (mode: AssignmentSortMode) => void;
  onChangeTitle: (id: string, taskName: string) => void;
  onMoveToTodo: (id: string) => void;
  onMoveToDone: (id: string) => void;
};

export default function AssignmentColumn({
  assignments,
  sortMode,
  systemTypes,
  isMobile,
  setNodeRef,
  style,
  gripRef,
  gripProps,
  highlighted,
  onSortModeChange,
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

      <div style={{ padding: '6px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {assignments.length === 0 ? (
          <EmptyState label="未完了の課題はありません" />
        ) : groups ? (
          groups.map(group => (
            <div key={group.label} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div
                className="text-[11px] font-bold flex items-center justify-between gap-3"
                style={{ padding: '6px 8px 3px', color: 'var(--c-text-3)' }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{group.label}</span>
                <span style={{ flexShrink: 0 }}>{group.items.length}</span>
              </div>
              {group.items.map(a => (
                <DraggableAssignmentCard
                  key={a.id}
                  assignment={a}
                  systemTypes={systemTypes}
                  isMobile={isMobile}
                  onChangeTitle={onChangeTitle}
                  onMoveToTodo={onMoveToTodo}
                  onMoveToDone={onMoveToDone}
                />
              ))}
            </div>
          ))
        ) : (
          <SortableContext
            items={assignments.map(a => `assignment:${a.id}`)}
            strategy={verticalListSortingStrategy}
          >
            {assignments.map(a => (
              <SortableAssignmentCard
                key={a.id}
                assignment={a}
                systemTypes={systemTypes}
                isMobile={isMobile}
                onChangeTitle={onChangeTitle}
                onMoveToTodo={onMoveToTodo}
                onMoveToDone={onMoveToDone}
              />
            ))}
          </SortableContext>
        )}
      </div>
    </ColumnShell>
  );
}

function SortableAssignmentCard({
  assignment,
  systemTypes,
  isMobile,
  onChangeTitle,
  onMoveToTodo,
  onMoveToDone,
}: {
  assignment: Assignment;
  systemTypes: Record<string, string | null>;
  isMobile?: boolean;
  onChangeTitle: (id: string, taskName: string) => void;
  onMoveToTodo: (id: string) => void;
  onMoveToDone: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `assignment:${assignment.id}`,
    data: { type: 'assignment', column: 'assignment', id: assignment.id },
  });

  return (
    <AssignmentListItem
      assignment={assignment}
      systemTypes={systemTypes}
      isMobile={isMobile}
      setNodeRef={setNodeRef}
      attributes={attributes}
      listeners={listeners}
      isDragging={isDragging}
      transform={CSS.Transform.toString(transform)}
      transition={transition}
      onChangeTitle={title => onChangeTitle(assignment.id, title)}
      onMoveToTodo={() => onMoveToTodo(assignment.id)}
      onMoveToDone={() => onMoveToDone(assignment.id)}
    />
  );
}

function DraggableAssignmentCard({
  assignment,
  systemTypes,
  isMobile,
  onChangeTitle,
  onMoveToTodo,
  onMoveToDone,
}: {
  assignment: Assignment;
  systemTypes: Record<string, string | null>;
  isMobile?: boolean;
  onChangeTitle: (id: string, taskName: string) => void;
  onMoveToTodo: (id: string) => void;
  onMoveToDone: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `assignment:${assignment.id}`,
    data: { type: 'assignment', column: 'assignment', id: assignment.id },
  });

  return (
    <AssignmentListItem
      assignment={assignment}
      systemTypes={systemTypes}
      isMobile={isMobile}
      setNodeRef={setNodeRef}
      attributes={attributes}
      listeners={listeners}
      isDragging={isDragging}
      onChangeTitle={title => onChangeTitle(assignment.id, title)}
      onMoveToTodo={() => onMoveToTodo(assignment.id)}
      onMoveToDone={() => onMoveToDone(assignment.id)}
    />
  );
}

function AssignmentListItem({
  assignment,
  systemTypes,
  isMobile,
  setNodeRef,
  attributes,
  listeners,
  isDragging,
  transform,
  transition,
  onChangeTitle,
  onMoveToTodo,
  onMoveToDone,
}: {
  assignment: Assignment;
  systemTypes: Record<string, string | null>;
  isMobile?: boolean;
  setNodeRef: (node: HTMLElement | null) => void;
  attributes: DraggableAttributes;
  listeners: DraggableSyntheticListeners;
  isDragging: boolean;
  transform?: string;
  transition?: string;
  onChangeTitle: (taskName: string) => void;
  onMoveToTodo: () => void;
  onMoveToDone: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(assignment.task_name);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debounceRef = useRef<number | null>(null);
  const pendingFocusRef = useRef(false);

  useEffect(() => {
    if (!isEditing) setDraft(assignment.task_name);
  }, [assignment.task_name, isEditing]);

  useEffect(() => {
    if (!isEditing || !pendingFocusRef.current) return;
    pendingFocusRef.current = false;
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [isEditing]);

  useLayoutEffect(() => {
    if (!isEditing) return;
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [draft, isEditing]);

  const commitTitle = (value: string) => {
    if (value !== assignment.task_name) onChangeTitle(value);
  };

  const scheduleCommit = (value: string) => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => commitTitle(value), 300);
  };

  const lmsHref = buildAssignmentHref(assignment, systemTypes);
  const deadline = formatRemainingDeadline(assignment.availability_end);
  const courseName = formatCourseName(assignment.course_name);

  const showButtons = isMobile ? (expanded && !isEditing) : (hovered && !isEditing);

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={isMobile ? () => setExpanded(v => !v) : undefined}
      style={{
        padding: '6px 10px',
        cursor: 'grab',
        touchAction: isMobile ? 'pan-y' : 'none',
        opacity: isDragging ? 0.08 : 1,
        transform,
        transition,
        ...(isDragging ? {
          outline: '2px dashed var(--c-accent)',
          outlineOffset: -2,
          borderRadius: 8,
        } : {}),
        ...getTextRowStyle('assignment', { selected: isEditing, isDragging, variant: 'list' }),
      }}
    >
      {/* Content grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '22px minmax(0, 1fr)', gap: 8 }}>
        <div />
        <div style={{ minWidth: 0 }}>
          <div className="text-[12px]" style={{ marginBottom: 1 }}>
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

          {isEditing && !isMobile ? (
            <textarea
              ref={textareaRef}
              value={draft}
              rows={1}
              onPointerDown={e => e.stopPropagation()}
              onChange={e => {
                setDraft(e.target.value);
                scheduleCommit(e.target.value);
              }}
              onBlur={() => {
                setIsEditing(false);
                setExpanded(false);
                if (debounceRef.current) window.clearTimeout(debounceRef.current);
                commitTitle(draft);
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  e.currentTarget.blur();
                }
              }}
              className="text-[13.5px] font-semibold"
              style={{
                display: 'block',
                width: '100%',
                resize: 'none',
                border: '1.5px solid var(--c-accent)',
                borderRadius: 4,
                outline: 'none',
                background: 'transparent',
                lineHeight: '1.55',
                padding: '2px 5px',
                fontFamily: 'inherit',
                overflow: 'hidden',
                color: 'var(--c-text-1)',
              }}
            />
          ) : (
            <div
              onClick={(e) => {
                if (isMobile) { e.stopPropagation(); return; }
                pendingFocusRef.current = true;
                setIsEditing(true);
              }}
              className="text-[13.5px] font-semibold"
              style={{
                cursor: isMobile ? 'default' : 'text',
                color: 'var(--c-text-1)',
                lineHeight: '1.55',
                minHeight: isMobile ? undefined : '1.55em',
                wordBreak: 'break-word',
                display: isMobile ? 'inline-block' : 'block',
              }}
            >
              {draft}
            </div>
          )}

          <div className="text-[12px] font-bold" style={{ color: deadline.color, marginTop: 1 }}>
            {deadline.label}
          </div>

          {/* Desktop-only inline buttons */}
          {!isMobile && (
            <div
              onClick={e => e.stopPropagation()}
              style={{
                display: 'flex',
                gap: 4,
                marginTop: 4,
                opacity: showButtons ? 1 : 0,
                pointerEvents: showButtons ? 'auto' : 'none',
                transition: 'opacity 0.12s',
              }}
            >
              <ActionButton onPointerDown={e => e.stopPropagation()} onClick={onMoveToTodo}>Todo→</ActionButton>
              <ActionButton onPointerDown={e => e.stopPropagation()} onClick={onMoveToDone}>完了→</ActionButton>
            </div>
          )}
        </div>
      </div>

      {/* Mobile action menu — expands below card content */}
      {isMobile && showButtons && (
        <MobileMenu
          onPointerDown={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
        >
          <MobileMenuItem
            onPointerDown={e => e.stopPropagation()}
            onClick={() => { onMoveToTodo(); setExpanded(false); }}
            trailing="→"
          >
            TODOへ
          </MobileMenuItem>
          <MobileMenuItem
            onPointerDown={e => e.stopPropagation()}
            onClick={() => { onMoveToDone(); setExpanded(false); }}
            trailing="→"
          >
            完了へ
          </MobileMenuItem>
        </MobileMenu>
      )}
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  onPointerDown,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  onPointerDown?: (e: React.PointerEvent<HTMLButtonElement>) => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onPointerDown={onPointerDown}
      onClick={onClick}
      className="text-[11px] font-semibold"
      style={{
        padding: '3px 7px',
        borderRadius: 5,
        border: danger ? 'none' : '1px solid var(--c-border)',
        background: danger ? 'transparent' : '#fff',
        color: danger ? 'var(--c-danger)' : 'var(--c-text-2)',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}

export function MobileMenu({
  children,
  onClick,
  onPointerDown,
}: {
  children: React.ReactNode;
  onClick?: React.MouseEventHandler;
  onPointerDown?: React.PointerEventHandler;
}) {
  return (
    <div
      onClick={onClick}
      onPointerDown={onPointerDown}
      style={{
        marginTop: 6,
        marginLeft: -10,
        marginRight: -10,
        marginBottom: -6,
        borderTop: '1px solid var(--c-border)',
      }}
    >
      {children}
    </div>
  );
}

export function MobileMenuItem({
  children,
  onClick,
  onPointerDown,
  leading,
  trailing,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  onPointerDown?: React.PointerEventHandler<HTMLButtonElement>;
  leading?: string;
  trailing?: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onPointerDown={onPointerDown}
      onClick={onClick}
      className="text-[14px] font-medium"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        padding: '12px 16px',
        background: 'transparent',
        border: 'none',
        borderTop: '1px solid var(--c-border)',
        color: danger ? 'var(--c-danger)' : 'var(--c-text-1)',
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {leading && (
          <span style={{ fontSize: 13, opacity: 0.55, fontWeight: 400 }}>{leading}</span>
        )}
        {children}
      </span>
      {trailing && (
        <span style={{ fontSize: 13, opacity: 0.45, fontWeight: 400 }}>{trailing}</span>
      )}
    </button>
  );
}
