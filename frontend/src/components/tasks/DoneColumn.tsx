import { Fragment, memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { type DoneItem, buildAssignmentHref, formatCourseName, formatDateTime } from '../../lib/tasksBoard';
import { ColumnHeader, ColumnShell, EmptyState, GhostCard, getTextRowStyle } from './ui';
import { MobileMenu, MobileMenuItem } from './MobileMenu';

type Props = {
  items: DoneItem[];
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
  onDeleteTodo: (id: string) => void;
  onDeleteAssignment: (id: string) => void;
  onMoveAssignmentToAssignment: (id: string) => void;
  onMoveAssignmentToTodo: (id: string) => void;
  onMoveTodoToTodo: (id: string) => void;
  onChangeAssignmentTitle: (id: string, taskName: string) => void;
};

export default memo(function DoneColumn({
  items,
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
  onDeleteTodo,
  onDeleteAssignment,
  onMoveAssignmentToAssignment,
  onMoveAssignmentToTodo,
  onMoveTodoToTodo,
  onChangeAssignmentTitle,
}: Props) {
  return (
    <ColumnShell setNodeRef={setNodeRef} style={style} highlighted={highlighted}>
      <ColumnHeader title="完了" count={items.length} gripRef={gripRef} gripProps={gripProps} />

      <div>
        <div className="text-[11px]" style={{ padding: '8px 14px', color: 'var(--c-text-3)', borderBottom: '1px solid #F1F3F6' }}>
          完了から1週間で自動的に消えます。TODOはドラッグで戻せます。
        </div>
        {items.length === 0 ? (
          ghostBeforeKey !== undefined
            ? <GhostCard label={activeDragLabel ?? null} />
            : <EmptyState label="完了したタスクはありません" />
        ) : (
          <SortableContext
            items={items.map(item => `done:${item.kind}:${item.data.id}`)}
            strategy={verticalListSortingStrategy}
          >
            <div style={{ padding: '6px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {items.map(item => {
                const itemKey = `done:${item.kind}:${item.data.id}`;
                return (
                  <Fragment key={`${item.kind}:${item.data.id}`}>
                    {ghostBeforeKey === itemKey && <GhostCard label={activeDragLabel ?? null} />}
                    <DoneCard
                      item={item}
                      systemTypes={systemTypes}
                      isMobile={isMobile}
                      busy={
                        item.kind === 'todo'
                          ? busyKeys.has(`todo-toggle-${item.data.id}`) || busyKeys.has(`todo-delete-${item.data.id}`)
                          : busyKeys.has(`assignment-delete-${item.data.id}`) || busyKeys.has(`assignment-done-${item.data.id}`)
                      }
                      onDeleteTodo={onDeleteTodo}
                      onDeleteAssignment={onDeleteAssignment}
                      onMoveAssignmentToAssignment={onMoveAssignmentToAssignment}
                      onMoveAssignmentToTodo={onMoveAssignmentToTodo}
                      onMoveTodoToTodo={onMoveTodoToTodo}
                      onChangeAssignmentTitle={onChangeAssignmentTitle}
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

const DoneCard = memo(function DoneCard({
  item,
  systemTypes,
  isMobile,
  busy,
  onDeleteTodo,
  onDeleteAssignment,
  onMoveAssignmentToAssignment,
  onMoveAssignmentToTodo,
  onMoveTodoToTodo,
  onChangeAssignmentTitle,
}: {
  item: DoneItem;
  systemTypes: Record<string, string | null>;
  isMobile?: boolean;
  busy: boolean;
  onDeleteTodo: (id: string) => void;
  onDeleteAssignment: (id: string) => void;
  onMoveAssignmentToAssignment: (id: string) => void;
  onMoveAssignmentToTodo: (id: string) => void;
  onMoveTodoToTodo: (id: string) => void;
  onChangeAssignmentTitle: (id: string, taskName: string) => void;
}) {
  const id = item.data.id;
  const kind = item.kind;

  const onDelete = useCallback(() => {
    if (kind === 'todo') onDeleteTodo(id);
    else onDeleteAssignment(id);
  }, [kind, id, onDeleteTodo, onDeleteAssignment]);

  const onMoveToAssignment = useCallback(() => {
    onMoveAssignmentToAssignment(id);
  }, [id, onMoveAssignmentToAssignment]);

  const onMoveToTodo = useCallback(() => {
    if (kind === 'assignment') onMoveAssignmentToTodo(id);
    else onMoveTodoToTodo(id);
  }, [kind, id, onMoveAssignmentToTodo, onMoveTodoToTodo]);

  const onChangeTitle = kind === 'assignment'
    ? (title: string) => onChangeAssignmentTitle(id, title)
    : undefined;
  const { attributes, listeners, setNodeRef, isDragging, transform, transition } = useSortable({
    id: `done:${item.kind}:${item.data.id}`,
    data: { type: 'done', column: 'done', doneKind: item.kind, id: item.data.id },
  });

  const [hovered, setHovered] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(item.kind === 'assignment' ? item.data.task_name : item.data.title);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debounceRef = useRef<number | null>(null);
  const pendingFocusRef = useRef(false);

  const currentTitle = item.kind === 'assignment' ? item.data.task_name : item.data.title;

  useEffect(() => {
    if (!isEditing) setDraft(currentTitle);
  }, [currentTitle, isEditing]);

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
    if (onChangeTitle && value !== currentTitle) onChangeTitle(value);
  };

  const scheduleCommit = (value: string) => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => commitTitle(value), 300);
  };

  const showButtons = isMobile ? (expanded && !isEditing) : (hovered && !isEditing);

  const lmsHref = item.kind === 'assignment' ? buildAssignmentHref(item.data, systemTypes) : undefined;
  const courseName = item.kind === 'assignment' ? formatCourseName(item.data.course_name) : undefined;

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
        transform: CSS.Transform.toString(transform),
        transition,
        ...(isDragging ? {
          outline: '2px dashed var(--c-accent)',
          outlineOffset: -2,
          borderRadius: 8,
        } : {}),
        ...getTextRowStyle(item.kind === 'assignment' ? 'assignment' : 'todo', { selected: isEditing, isDragging, variant: 'list' }),
      }}
    >
      {/* Content grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '22px minmax(0, 1fr)', gap: 8 }}>
        <div />
        <div style={{ minWidth: 0 }}>
          {item.kind === 'assignment' && (
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
          )}

          {isEditing && onChangeTitle && !isMobile ? (
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
                if (!onChangeTitle || isMobile) return; // モバイルはバブルアップさせてexpandを発火
                pendingFocusRef.current = true;
                setIsEditing(true);
              }}
              className="text-[13.5px] font-semibold"
              style={{
                cursor: (onChangeTitle && !isMobile) ? 'text' : 'default',
                color: 'var(--c-text-3)',
                lineHeight: '1.55',
                minHeight: isMobile ? undefined : '1.55em',
                wordBreak: 'break-word',
                display: isMobile ? 'inline-block' : 'block',
              }}
            >
              {draft}
            </div>
          )}

          <div className="text-[11px]" style={{ color: 'var(--c-text-3)', marginTop: 1 }}>
            {formatDateTime(item.data.done_at) ?? '完了'}
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
              {kind === 'assignment' && (
                <DoneActionButton onPointerDown={e => e.stopPropagation()} onClick={onMoveToAssignment}>←課題</DoneActionButton>
              )}
              <DoneActionButton onPointerDown={e => e.stopPropagation()} onClick={onMoveToTodo}>←Todo</DoneActionButton>
              <DoneActionButton danger disabled={busy} onPointerDown={e => e.stopPropagation()} onClick={onDelete}>削除</DoneActionButton>
            </div>
          )}
        </div>
      </div>

      {/* Mobile action menu */}
      {isMobile && showButtons && (
        <MobileMenu
          onClick={e => e.stopPropagation()}
          onPointerDown={e => e.stopPropagation()}
        >
          {kind === 'assignment' && (
            <MobileMenuItem
              onPointerDown={e => e.stopPropagation()}
              onClick={() => { onMoveToAssignment(); setExpanded(false); }}
              leading="←"
            >
              課題へ
            </MobileMenuItem>
          )}
          <MobileMenuItem
            onPointerDown={e => e.stopPropagation()}
            onClick={() => { onMoveToTodo(); setExpanded(false); }}
            leading="←"
          >
            TODOへ
          </MobileMenuItem>
          <MobileMenuItem
            onPointerDown={e => e.stopPropagation()}
            onClick={() => { onDelete(); setExpanded(false); }}
            danger
          >
            削除
          </MobileMenuItem>
        </MobileMenu>
      )}
    </div>
  );
});

function DoneActionButton({
  children,
  onClick,
  onPointerDown,
  danger,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  onPointerDown?: (e: React.PointerEvent<HTMLButtonElement>) => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={onPointerDown}
      onClick={onClick}
      className="text-[11px] font-semibold"
      style={{
        padding: '3px 7px',
        borderRadius: 5,
        border: danger ? 'none' : '1px solid var(--c-border)',
        background: danger ? 'transparent' : '#fff',
        color: danger ? 'var(--c-danger)' : 'var(--c-text-2)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}
