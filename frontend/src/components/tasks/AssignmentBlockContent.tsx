import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { Assignment } from '../../api/tasks';
import { buildAssignmentHref, formatCourseName, formatRemainingDeadline } from '../../lib/tasksBoard';
import { TodoActionButton } from './TodoActionButton';
import {
  blockMutatingKeys,
  focusTextareaAt,
  isCurrentLineEmpty,
  isOnFirstVisualLine,
  isOnLastVisualLine,
  nonEditableTextareaHandlers,
  useAutoGrowTextarea,
  type AssignmentFocusField,
  type CaretPos,
  type TodoBlockVariant,
} from './todoBlockHelpers';

// 課題ブロック。授業名・残り期限は変更不可（LMS由来）だが、disabled/readOnly は使わず通常の
// textarea として表示する（caret表示・ドラッグ選択・矢印キー移動をブラウザネイティブに保つため）。
// 値を変える操作だけを個別にブロックし、課題名だけ編集可能にする。3行は ↑↓ で行き来できる。
// リストモードでは課題名だけクリックで編集可能、他はテキスト表示。
export function AssignmentBlockContent({
  assignment,
  systemTypes,
  variant,
  isMobile,
  expanded = false,
  onExpand,
  autoFocus = false,
  caret = 'end',
  focusField,
  hovered = false,
  onConsumeFocus,
  onChangeTaskName,
  onCreateBelow,
  onCreateBefore,
  onNavigate,
  onMoveToAssignment,
  onMoveToDone,
}: {
  assignment: Assignment;
  systemTypes: Record<string, string | null>;
  variant: TodoBlockVariant;
  isMobile?: boolean;
  expanded?: boolean;
  onExpand?: () => void;
  autoFocus?: boolean;
  caret?: CaretPos;
  focusField?: AssignmentFocusField;
  hovered?: boolean;
  onConsumeFocus?: () => void;
  onChangeTaskName: (id: string, taskName: string) => void;
  onCreateBelow: (afterId: string) => void;
  onCreateBefore: (beforeId: string) => void;
  onNavigate: (id: string, dir: 'prev' | 'next') => void;
  onMoveToAssignment?: () => void;
  onMoveToDone?: () => void;
}) {
  const lmsHref = buildAssignmentHref(assignment, systemTypes);
  const deadline = formatRemainingDeadline(assignment.availability_end);
  const courseName = formatCourseName(assignment.course_name);

  const courseRef = useAutoGrowTextarea(courseName);
  const deadlineRef = useAutoGrowTextarea(deadline.label);

  const [titleDraft, setTitleDraft] = useState(assignment.task_name);
  const [titleFocused, setTitleFocused] = useState(false);
  const titleDebounceRef = useRef<number | null>(null);
  const titleRef = useAutoGrowTextarea(titleDraft);

  // リストモード用: 課題名のクリック編集状態
  const [isListTitleEditing, setIsListTitleEditing] = useState(false);
  const pendingFocusRef = useRef<CaretPos | null>(null);

  useEffect(() => {
    if (!titleFocused) setTitleDraft(assignment.task_name);
  }, [assignment.task_name, titleFocused]);

  // テキストモード: autoFocus 時の各フィールドへのフォーカス処理
  // リストモード: 課題名の編集モードに入る
  useEffect(() => {
    if (!autoFocus) return;
    if (variant === 'list') {
      pendingFocusRef.current = caret;
      setIsListTitleEditing(true);
      return;
    }
    const pos = caret === 'start' ? 'start' : 'end';
    if (focusField === 'course') {
      focusTextareaAt(courseRef.current, pos);
    } else if (focusField === 'deadline') {
      focusTextareaAt(deadlineRef.current, pos);
    } else {
      focusTextareaAt(titleRef.current, pos);
    }
    onConsumeFocus?.();
  }, [autoFocus, caret, focusField, variant, onConsumeFocus]); // eslint-disable-line react-hooks/exhaustive-deps

  // リストモード: 編集開始後に課題名 textarea へフォーカスする
  useEffect(() => {
    if (!isListTitleEditing) return;
    const pending = pendingFocusRef.current;
    if (pending === null) return;
    pendingFocusRef.current = null;
    const el = titleRef.current;
    if (!el) return;
    el.focus();
    const pos = pending === 'start' ? 0 : el.value.length;
    el.setSelectionRange(pos, pos);
    onConsumeFocus?.();
  }, [isListTitleEditing, onConsumeFocus]); // eslint-disable-line react-hooks/exhaustive-deps

  const commitTitle = (value: string) => {
    if (value !== assignment.task_name) onChangeTaskName(assignment.id, value);
  };

  const scheduleCommitTitle = (value: string) => {
    if (titleDebounceRef.current) window.clearTimeout(titleDebounceRef.current);
    titleDebounceRef.current = window.setTimeout(() => commitTitle(value), 300);
  };

  // ---- リストモード JSX ----
  if (variant === 'list') {
    return (
      <div style={{ lineHeight: 1.55 }}>
        <div className="flex items-start gap-1.5" style={{ marginBottom: 2 }}>
          {lmsHref ? (
            <a
              href={lmsHref}
              target="webclass"
              rel="noopener noreferrer"
              onPointerDown={e => e.stopPropagation()}
              className="text-[12.5px] font-semibold"
              style={{ color: 'var(--c-accent)', textDecoration: 'none', lineHeight: '1.55' }}
            >
              {courseName || 'LMSで開く'}
            </a>
          ) : (
            <span className="text-[12.5px]" style={{ color: 'var(--c-text-3)', lineHeight: '1.55' }}>
              {courseName || '授業未設定'}
            </span>
          )}
        </div>

        {isListTitleEditing ? (
          <textarea
            ref={titleRef}
            value={titleDraft}
            rows={1}
            onPointerDown={e => e.stopPropagation()}
            onChange={e => {
              setTitleDraft(e.target.value);
              scheduleCommitTitle(e.target.value);
            }}
            onFocus={() => setTitleFocused(true)}
            onBlur={() => {
              setTitleFocused(false);
              setIsListTitleEditing(false);
              if (titleDebounceRef.current) window.clearTimeout(titleDebounceRef.current);
              commitTitle(titleDraft);
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
              pendingFocusRef.current = 'end';
              setIsListTitleEditing(true);
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
            {titleDraft}
          </div>
        )}

        <div className="text-[12.5px] font-bold" style={{ color: deadline.color, marginTop: 2 }}>
          {deadline.label}
        </div>

        {!isMobile && (onMoveToAssignment || onMoveToDone) && (
          <div
            onClick={e => e.stopPropagation()}
            style={{
              display: 'flex',
              gap: 4,
              marginTop: 4,
              opacity: hovered && !isListTitleEditing ? 1 : 0,
              pointerEvents: hovered && !isListTitleEditing ? 'auto' : 'none',
              transition: 'opacity 0.12s',
            }}
          >
            {onMoveToAssignment && (
              <TodoActionButton onPointerDown={e => e.stopPropagation()} onClick={onMoveToAssignment}>←課題</TodoActionButton>
            )}
            {onMoveToDone && (
              <TodoActionButton onPointerDown={e => e.stopPropagation()} onClick={onMoveToDone}>完了→</TodoActionButton>
            )}
          </div>
        )}
      </div>
    );
  }

  // ---- テキストモード JSX（既存実装） ----

  // 授業名 / 課題名 / 期限 は同じブロック内の3行として、↑↓ で行き来できるようにする。
  const handleCourseKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (e.shiftKey) return;
      onCreateBefore(assignment.id);
      return;
    }
    if (blockMutatingKeys(e)) return;
    if (e.key === 'ArrowDown' && isOnLastVisualLine(e.currentTarget)) {
      e.preventDefault();
      focusTextareaAt(titleRef.current, 'start');
    } else if (e.key === 'ArrowUp' && isOnFirstVisualLine(e.currentTarget)) {
      e.preventDefault();
      onNavigate(assignment.id, 'prev');
    }
  };

  const handleTitleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      const el = e.currentTarget;
      const caretStart = el.selectionStart ?? titleDraft.length;
      if (isCurrentLineEmpty(titleDraft, caretStart)) {
        e.preventDefault();
        const cleaned = titleDraft.replace(/\n+$/, '');
        setTitleDraft(cleaned);
        commitTitle(cleaned);
        onCreateBelow(assignment.id);
        return;
      }
      return;
    }
    if (e.key === 'ArrowUp' && isOnFirstVisualLine(e.currentTarget)) {
      e.preventDefault();
      focusTextareaAt(courseRef.current, 'end');
    } else if (e.key === 'ArrowDown' && isOnLastVisualLine(e.currentTarget)) {
      e.preventDefault();
      focusTextareaAt(deadlineRef.current, 'start');
    }
  };

  const handleDeadlineKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (e.shiftKey) return;
      onCreateBelow(assignment.id);
      return;
    }
    if (blockMutatingKeys(e)) return;
    if (e.key === 'ArrowUp' && isOnFirstVisualLine(e.currentTarget)) {
      e.preventDefault();
      focusTextareaAt(titleRef.current, 'end');
    } else if (e.key === 'ArrowDown' && isOnLastVisualLine(e.currentTarget)) {
      e.preventDefault();
      onNavigate(assignment.id, 'next');
    }
  };

  const textareaBaseStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    resize: 'none',
    border: 'none',
    outline: 'none',
    background: 'transparent',
    cursor: 'text',
    lineHeight: '1.55',
    padding: 0,
    fontFamily: 'inherit',
    overflow: 'hidden',
  };

  return (
    <div style={{ lineHeight: 1.55 }}>
      <div className="flex items-start gap-1.5">
        <textarea
          ref={courseRef}
          value={courseName || '授業未設定'}
          rows={1}
          onPointerDown={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
          {...nonEditableTextareaHandlers}
          onKeyDown={handleCourseKeyDown}
          className={`text-[12.5px] ${lmsHref ? 'font-semibold' : ''}`}
          style={{ ...textareaBaseStyle, color: lmsHref ? 'var(--c-accent)' : 'var(--c-text-3)', flex: 1, minWidth: 0 }}
        />
        {lmsHref && (
          <a
            href={lmsHref}
            target="webclass"
            rel="noopener noreferrer"
            onPointerDown={e => e.stopPropagation()}
            aria-label="LMSで開く"
            title="LMSで開く"
            className="text-[11px]"
            style={{ color: 'var(--c-accent)', textDecoration: 'none', flexShrink: 0, lineHeight: '1.55' }}
          >
            ↗
          </a>
        )}
      </div>
      <textarea
        ref={titleRef}
        value={titleDraft}
        rows={1}
        onPointerDown={e => e.stopPropagation()}
        onChange={e => {
          setTitleDraft(e.target.value);
          scheduleCommitTitle(e.target.value);
        }}
        onFocus={() => setTitleFocused(true)}
        onBlur={() => {
          setTitleFocused(false);
          if (titleDebounceRef.current) window.clearTimeout(titleDebounceRef.current);
          commitTitle(titleDraft);
        }}
        onKeyDown={handleTitleKeyDown}
        className="text-[13.5px] font-semibold"
        style={{ ...textareaBaseStyle, color: 'var(--c-text-1)' }}
      />
      <textarea
        ref={deadlineRef}
        value={deadline.label}
        rows={1}
        onPointerDown={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
        {...nonEditableTextareaHandlers}
        onKeyDown={handleDeadlineKeyDown}
        className="text-[12.5px] font-bold"
        style={{ ...textareaBaseStyle, color: deadline.color }}
      />
    </div>
  );
}
