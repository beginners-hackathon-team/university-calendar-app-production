import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Assignment, Todo } from '../../api/tasks';
import {
  type TodoColumnItem,
  buildAssignmentHref,
  formatCourseName,
  formatRemainingDeadline,
  todoColumnItemKey,
} from '../../lib/tasksBoard';
import { getTextRowStyle } from './ui';

export type CaretPos = 'start' | 'end';
export type TodoBlockVariant = 'text' | 'list';
// 課題ブロックの外部からのフォーカス先（省略時は課題タイトル）。
export type AssignmentFocusField = 'course' | 'title' | 'deadline';

type Props = {
  item: TodoColumnItem;
  variant: TodoBlockVariant;
  lineNumber?: number;
  isLast?: boolean;
  systemTypes: Record<string, string | null>;
  busy: boolean;
  autoFocus?: boolean;
  caret?: CaretPos;
  focusField?: AssignmentFocusField;
  onConsumeFocus?: () => void;
  onChangeTitle: (id: string, title: string) => void;
  onChangeAssignmentTitle: (id: string, taskName: string) => void;
  onCreateBelow: (afterId: string) => void;
  onCreateBefore: (beforeId: string) => void;
  onDeleteBlock: (id: string, focusPrev: boolean) => void;
  onNavigate: (id: string, dir: 'prev' | 'next') => void;
  onEnsureTrailingBlock?: (id: string) => void;
  onMoveAssignmentToAssignment?: () => void;
  onMoveAssignmentToDone?: () => void;
  onMoveTodoToDone?: () => void;
};

// 内容に合わせて高さを自動調整する textarea 用フック（編集可・読み取り専用どちらでも使う）。
function useAutoGrowTextarea(value: string) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return ref;
}

// 授業名・期限は disabled/readOnly を使わない（caret表示・ドラッグ選択・←/→/↑/↓/Home/End の
// 移動をブラウザネイティブの挙動のまま保つため）。代わりに「値を変える操作」
// （入力・Backspace・Delete・貼り付け・カット・ドロップ）だけを個別にブロックする。
// Enter は「次のブロックを作る」というアクションに使うため、ここでは扱わずフィールド側で個別に処理する。
const NON_EDITABLE_KEYS = new Set(['Backspace', 'Delete']);

// 値を変える操作だけ preventDefault する。ブロックした場合は true を返す
// （呼び出し側はそれ以上のキー処理をスキップできる）。矢印キー/Home/Endはここでは一切触らない。
function blockMutatingKeys(e: KeyboardEvent<HTMLTextAreaElement>): boolean {
  if (NON_EDITABLE_KEYS.has(e.key)) {
    e.preventDefault();
    return true;
  }
  return false;
}

// 「カーソルがある行（前後の改行に挟まれた範囲）が空かどうか」を判定する。
// Enter を押したときに「同じブロック内で改行する」か「次のブロックを作る」かの分岐に使う
// （カーソルより前だけを見ると、行の途中で改行を入れたときに誤判定するため、行全体を見る）。
function isCurrentLineEmpty(value: string, caretStart: number): boolean {
  const lineStart = value.lastIndexOf('\n', caretStart - 1) + 1;
  const lineEndIdx = value.indexOf('\n', caretStart);
  return value.slice(lineStart, lineEndIdx === -1 ? value.length : lineEndIdx) === '';
}

const nonEditableTextareaHandlers = {
  // value はReactの state で制御しているため変化しないが、controlled textarea として
  // onChange が必須なため no-op を渡す（実際に発火することは想定していない）。
  onChange: () => {},
  onBeforeInput: (e: React.FormEvent<HTMLTextAreaElement>) => e.preventDefault(),
  onPaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => e.preventDefault(),
  onCut: (e: React.ClipboardEvent<HTMLTextAreaElement>) => e.preventDefault(),
  onDrop: (e: React.DragEvent<HTMLTextAreaElement>) => e.preventDefault(),
};

// テキストエリア内で「先頭行/最終行にいるか」を判定する（複数行に折り返している場合は
// その内部の移動を優先し、端まで来たときだけ隣の行（textarea）へ移動する）。
function isOnFirstVisualLine(el: HTMLTextAreaElement): boolean {
  return !el.value.slice(0, el.selectionStart ?? 0).includes('\n');
}
function isOnLastVisualLine(el: HTMLTextAreaElement): boolean {
  return !el.value.slice(el.selectionEnd ?? el.value.length).includes('\n');
}
function focusTextareaAt(el: HTMLTextAreaElement | null, pos: 'start' | 'end') {
  if (!el) return;
  el.focus();
  const index = pos === 'start' ? 0 : el.value.length;
  el.setSelectionRange(index, index);
}

// TODOカラムの1ブロック（Todo / 課題 共通）。
// リストモードは従来どおり（カード寄りの強調・ドラッグ並び替え）。
// テキストモードは「本当にエディタに見えるUI」を優先し、通常時は背景・枠線・角丸を
// 一切出さず、行番号ガターだけ固定幅で揃えた、ただのテキスト行として表示する。
// ドラッグ操作（オブジェクト化）はテキストモードでは一旦オフにしている（後で戻す）。
export default function TodoBlock({
  item,
  variant,
  lineNumber,
  isLast = false,
  systemTypes,
  busy,
  autoFocus = false,
  caret = 'end',
  focusField,
  onConsumeFocus,
  onChangeTitle,
  onChangeAssignmentTitle,
  onCreateBelow,
  onCreateBefore,
  onDeleteBlock,
  onNavigate,
  onEnsureTrailingBlock,
  onMoveAssignmentToAssignment,
  onMoveAssignmentToDone,
  onMoveTodoToDone,
}: Props) {
  const id = item.type === 'todo' ? item.todo.id : item.assignment.id;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: todoColumnItemKey(item),
    data: { type: item.type, column: 'todo', id },
  });

  // ホバーは「テキストモードのごく薄いハイライト」と「削除ボタンの表示判定」に使う。
  const [hovered, setHovered] = useState(false);
  // Todo のテキストエリアにフォーカスがある間は「現在行」としてハイライトを出す。
  const [focused, setFocused] = useState(false);

  const isListVariant = variant === 'list';

  const style: React.CSSProperties = isListVariant
    ? {
        transform: CSS.Transform.toString(transform),
        transition,
        cursor: 'grab',
        touchAction: 'none',
        // 課題・完了カラムと同じく透明度でドラッグ状態を表現（シャドウは使わない）。
        opacity: isDragging ? 0.5 : 1,
        display: 'grid',
        gridTemplateColumns: '22px minmax(0, 1fr)',
        gap: 8,
        padding: '6px 10px',
        ...getTextRowStyle(item.type, { selected: focused, variant }),
      }
    : {
        display: 'grid',
        gridTemplateColumns: '22px minmax(0, 1fr)',
        gap: 8,
        padding: '0 6px',
        borderRadius: hovered || focused ? 3 : 0,
        // VSCode の「現在行ハイライト」のような、ごく薄い背景のみ。境界線・角丸の強調・
        // ドラッグの浮き上がりは出さない（通常時は完全に透明）。
        background: hovered || focused ? 'rgba(15, 23, 42, 0.045)' : 'transparent',
      };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(isListVariant ? attributes : {})}
      {...(isListVariant ? listeners : {})}
      title={isListVariant ? 'ドラッグして並び替え' : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className="text-[11px]"
        style={{
          color: 'var(--c-text-3)',
          textAlign: 'right',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          userSelect: 'none',
          lineHeight: '1.55',
        }}
      >
        {lineNumber ?? ''}
      </div>
      <div style={{ minWidth: 0 }}>
        {item.type === 'assignment' ? (
          <AssignmentBlockContent
            assignment={item.assignment}
            systemTypes={systemTypes}
            variant={variant}
            autoFocus={autoFocus}
            caret={caret}
            focusField={focusField}
            hovered={hovered}
            onConsumeFocus={onConsumeFocus}
            onChangeTaskName={onChangeAssignmentTitle}
            onCreateBelow={onCreateBelow}
            onCreateBefore={onCreateBefore}
            onNavigate={onNavigate}
            onMoveToAssignment={onMoveAssignmentToAssignment}
            onMoveToDone={onMoveAssignmentToDone}
          />
        ) : (
          <TodoBlockContent
            todo={item.todo}
            busy={busy}
            isLast={isLast}
            variant={variant}
            autoFocus={autoFocus}
            caret={caret}
            hovered={hovered}
            focused={focused}
            onFocusChange={setFocused}
            onConsumeFocus={onConsumeFocus}
            onChangeTitle={onChangeTitle}
            onCreateBelow={onCreateBelow}
            onDeleteBlock={onDeleteBlock}
            onNavigate={onNavigate}
            onEnsureTrailingBlock={onEnsureTrailingBlock}
            onMoveToDone={onMoveTodoToDone}
          />
        )}
      </div>
    </div>
  );
}

// 課題ブロック。授業名・残り期限は変更不可（LMS由来）だが、disabled/readOnly は使わず通常の
// textarea として表示する（caret表示・ドラッグ選択・矢印キー移動をブラウザネイティブに保つため）。
// 値を変える操作だけを個別にブロックし、課題名だけ編集可能にする。3行は ↑↓ で行き来できる。
// リストモードでは課題名だけクリックで編集可能、他はテキスト表示。
function AssignmentBlockContent({
  assignment,
  systemTypes,
  variant,
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
              pendingFocusRef.current = 'end';
              setIsListTitleEditing(true);
            }}
            className="text-[13.5px] font-semibold"
            style={{
              cursor: 'text',
              color: 'var(--c-text-1)',
              lineHeight: '1.55',
              minHeight: '1.55em',
              wordBreak: 'break-word',
            }}
          >
            {titleDraft}
          </div>
        )}

        <div className="text-[12.5px] font-bold" style={{ color: deadline.color, marginTop: 2 }}>
          {deadline.label}
        </div>

        {(onMoveToAssignment || onMoveToDone) && (
          <div
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

// Todo ブロック。複数行入力可能で、空行で次のブロックへ、空ブロックで Backspace すると削除される。
// リストモードではクリックで編集開始、ブラー時に保存。
function TodoBlockContent({
  todo,
  busy,
  isLast,
  variant,
  autoFocus,
  caret,
  hovered,
  focused,
  onFocusChange,
  onConsumeFocus,
  onChangeTitle,
  onCreateBelow,
  onDeleteBlock,
  onNavigate,
  onEnsureTrailingBlock,
  onMoveToDone,
}: {
  todo: Todo;
  busy: boolean;
  isLast: boolean;
  variant: TodoBlockVariant;
  autoFocus: boolean;
  caret: CaretPos;
  hovered: boolean;
  focused: boolean;
  onFocusChange: (focused: boolean) => void;
  onConsumeFocus?: () => void;
  onChangeTitle: (id: string, title: string) => void;
  onCreateBelow: (afterId: string) => void;
  onDeleteBlock: (id: string, focusPrev: boolean) => void;
  onNavigate: (id: string, dir: 'prev' | 'next') => void;
  onEnsureTrailingBlock?: (id: string) => void;
  onMoveToDone?: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState(todo.title);
  const debounceRef = useRef<number | null>(null);

  // リストモード用: クリック編集状態
  const [isListEditing, setIsListEditing] = useState(false);
  const pendingFocusRef = useRef<CaretPos | null>(null);

  const isEditing = variant === 'text' || isListEditing;

  // 外部からタイトルが変わったら（編集中でなければ）同期する。
  useEffect(() => {
    if (!focused && !isListEditing) setDraft(todo.title);
  }, [todo.title, focused, isListEditing]);

  // 内容に合わせて高さを自動調整する（編集中のみ）。
  useLayoutEffect(() => {
    if (!isEditing) return;
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [draft, isEditing]);

  // autoFocus: テキストモードは直接フォーカス、リストモードは編集モードに入ってからフォーカス。
  useEffect(() => {
    if (!autoFocus) return;
    if (variant === 'list') {
      pendingFocusRef.current = caret;
      setIsListEditing(true);
      return;
    }
    const el = textareaRef.current;
    if (el) {
      el.focus();
      const pos = caret === 'start' ? 0 : el.value.length;
      el.setSelectionRange(pos, pos);
    }
    onConsumeFocus?.();
  }, [autoFocus, caret, variant, onConsumeFocus]); // eslint-disable-line react-hooks/exhaustive-deps

  // リストモード: 編集開始後に textarea へフォーカスする。
  useEffect(() => {
    if (!isEditing) return;
    const pending = pendingFocusRef.current;
    if (pending === null) return;
    pendingFocusRef.current = null;
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    const pos = pending === 'start' ? 0 : el.value.length;
    el.setSelectionRange(pos, pos);
    onConsumeFocus?.();
  }, [isEditing, onConsumeFocus]); // eslint-disable-line react-hooks/exhaustive-deps

  const commit = (value: string) => {
    if (value !== todo.title) onChangeTitle(todo.id, value);
  };

  const scheduleCommit = (value: string) => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => commit(value), 300);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // リストモードでは Enter で確定、複雑なブロック操作はしない。
    if (variant === 'list') {
      if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        e.currentTarget.blur();
      }
      return;
    }

    // テキストモード: 既存の複雑なキー操作。
    const el = e.currentTarget;
    const caretStart = el.selectionStart;
    const collapsed = el.selectionStart === el.selectionEnd;

    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      if (isCurrentLineEmpty(draft, caretStart)) {
        e.preventDefault();
        const cleaned = draft.replace(/\n+$/, '');
        setDraft(cleaned);
        commit(cleaned);
        onCreateBelow(todo.id);
        return;
      }
      return;
    }

    if (e.key === 'Backspace' && draft === '' && caretStart === 0) {
      e.preventDefault();
      onDeleteBlock(todo.id, true);
      return;
    }

    if (!collapsed) return;
    if (e.key === 'ArrowUp') {
      if (!draft.slice(0, caretStart).includes('\n')) {
        e.preventDefault();
        onNavigate(todo.id, 'prev');
      }
    } else if (e.key === 'ArrowDown') {
      if (!draft.slice(caretStart).includes('\n')) {
        e.preventDefault();
        onNavigate(todo.id, 'next');
      }
    } else if (e.key === 'ArrowLeft') {
      if (caretStart === 0) {
        e.preventDefault();
        onNavigate(todo.id, 'prev');
      }
    } else if (e.key === 'ArrowRight') {
      if (caretStart === draft.length) {
        e.preventDefault();
        onNavigate(todo.id, 'next');
      }
    }
  };

  const showDelete = hovered || focused;
  const showMoveButtons = (hovered || focused) && !isListEditing && variant === 'list';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'start', gap: 6 }}>
      <div>
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={draft}
            rows={1}
            onPointerDown={e => e.stopPropagation()}
            onChange={e => {
              setDraft(e.target.value);
              scheduleCommit(e.target.value);
            }}
            onFocus={() => onFocusChange(true)}
            onBlur={() => {
              onFocusChange(false);
              if (variant === 'list') setIsListEditing(false);
              if (debounceRef.current) window.clearTimeout(debounceRef.current);
              commit(draft);
              if (variant === 'text' && isLast && draft.trim() !== '') onEnsureTrailingBlock?.(todo.id);
            }}
            onKeyDown={handleKeyDown}
            className="text-[13.5px]"
            style={{
              width: '100%',
              resize: 'none',
              border: variant === 'list' ? '1.5px solid var(--c-accent)' : 'none',
              borderRadius: variant === 'list' ? 4 : 0,
              outline: 'none',
              background: 'transparent',
              cursor: 'text',
              color: 'var(--c-text-1)',
              lineHeight: '1.55',
              padding: variant === 'list' ? '2px 5px' : 0,
              fontFamily: 'inherit',
              overflow: 'hidden',
            }}
          />
        ) : (
          // リストモード: 通常時はテキスト表示、クリックで編集開始。
          <div
            onClick={() => {
              pendingFocusRef.current = 'end';
              setIsListEditing(true);
            }}
            className="text-[13.5px]"
            style={{
              cursor: 'text',
              color: draft ? 'var(--c-text-1)' : 'var(--c-text-3)',
              lineHeight: '1.55',
              padding: 0,
              minHeight: '1.55em',
              wordBreak: 'break-word',
              whiteSpace: 'pre-wrap',
            }}
          >
            {draft || 'クリックして編集'}
          </div>
        )}
        {onMoveToDone && (
          <div
            style={{
              marginTop: 4,
              opacity: showMoveButtons ? 1 : 0,
              pointerEvents: showMoveButtons ? 'auto' : 'none',
              transition: 'opacity 0.12s',
            }}
          >
            <TodoActionButton onPointerDown={e => e.stopPropagation()} onClick={onMoveToDone}>完了→</TodoActionButton>
          </div>
        )}
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={() => onDeleteBlock(todo.id, false)}
        className="text-[13px]"
        aria-label="削除"
        title="削除"
        style={{
          border: 'none',
          background: 'transparent',
          color: 'var(--c-text-3)',
          cursor: busy ? 'not-allowed' : 'pointer',
          lineHeight: '24px',
          opacity: showDelete ? 0.7 : 0,
          transition: 'opacity 0.12s',
        }}
      >
        ×
      </button>
    </div>
  );
}

function TodoActionButton({
  children,
  onClick,
  onPointerDown,
}: {
  children: React.ReactNode;
  onClick: () => void;
  onPointerDown?: (e: React.PointerEvent<HTMLButtonElement>) => void;
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
        border: '1px solid var(--c-border)',
        background: '#fff',
        color: 'var(--c-text-2)',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}
