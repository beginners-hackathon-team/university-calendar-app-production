import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core';
import type { Assignment } from '../../api/tasks';
import { buildAssignmentHref, formatCourseName, formatRemainingDeadline } from '../../lib/tasksBoard';
import { getTextRowStyle } from './ui';
import { ActionButton } from './ActionButton';
import { MobileMenu, MobileMenuItem } from './MobileMenu';

export function AssignmentListItem({
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
  const isClickable = !!lmsHref && assignment.is_active_url;
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
            {isClickable ? (
              <a
                href={lmsHref!}
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
              onClick={() => {
                if (isMobile) return; // バブルアップさせてカードのexpandを発火
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
