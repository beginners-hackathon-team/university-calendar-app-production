import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { Todo } from '../../api/tasks';
import { TodoActionButton } from './TodoActionButton';
import { isCurrentLineEmpty, isOnFirstVisualLine, isOnLastVisualLine, type CaretPos, type TodoBlockVariant } from './todoBlockHelpers';

// Todo ブロック。複数行入力可能で、空行で次のブロックへ、空ブロックで Backspace すると削除される。
// リストモードではクリックで編集開始、ブラー時に保存。
export function TodoBlockContent({
  todo,
  busy,
  isLast,
  variant,
  isMobile,
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
  internalFocusMoveRef,
  onMoveToDone,
  startEditRef,
}: {
  todo: Todo;
  busy: boolean;
  isLast: boolean;
  variant: TodoBlockVariant;
  isMobile?: boolean;
  expanded?: boolean;
  onExpand?: () => void;
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
  internalFocusMoveRef?: React.MutableRefObject<boolean>;
  onMoveToDone?: () => void;
  startEditRef?: React.MutableRefObject<(() => void) | null>;
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

  // モバイルメニューの「編集」から呼び出せるように ref に関数を登録する。
  useEffect(() => {
    if (startEditRef) {
      startEditRef.current = () => {
        pendingFocusRef.current = 'end';
        setIsListEditing(true);
      };
    }
    return () => {
      if (startEditRef) startEditRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const commit = (value: string) => {
    if (value !== todo.title) onChangeTitle(todo.id, value);
  };

  const scheduleCommit = (value: string) => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => commit(value), 300);
  };

  // PC では keydown → beforeinput の順で発火し、keydown で preventDefault() すると
  // beforeinput は発火しない。モバイルでは keydown が発火しないため beforeinput で補完する。
  const applyEmptyLineEnter = (el: HTMLTextAreaElement, preventDefault: () => void) => {
    const caretStart = el.selectionStart ?? 0;
    if (isCurrentLineEmpty(draft, caretStart)) {
      preventDefault();
      const cleaned = draft.replace(/\n+$/, '');
      setDraft(cleaned);
      commit(cleaned);
      onCreateBelow(todo.id);
      return true;
    }
    return false;
  };

  const handleBeforeInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    if (variant !== 'text') return;
    if ((e.nativeEvent as InputEvent).inputType !== 'insertLineBreak') return;
    applyEmptyLineEnter(e.currentTarget, () => e.preventDefault());
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
      // PC キーボードはここで処理。成功すると beforeinput は発火しない。
      applyEmptyLineEnter(el, () => e.preventDefault());
      return;
    }

    if (e.key === 'Backspace' && draft === '' && caretStart === 0) {
      e.preventDefault();
      onDeleteBlock(todo.id, true);
      return;
    }

    if (!collapsed) return;
    if (e.key === 'ArrowUp') {
      // 折り返し（ソフトラップ）で複数行に見えている場合は、その内部の移動を優先し、
      // 見た目の先頭行に来たときだけ隣のブロックへ移動する。
      if (isOnFirstVisualLine(el)) {
        e.preventDefault();
        onNavigate(todo.id, 'prev');
      }
    } else if (e.key === 'ArrowDown') {
      if (isOnLastVisualLine(el)) {
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

  const showDelete = isMobile ? false : (hovered || focused);
  const showMoveButtons = isMobile ? false : ((hovered || focused) && !isListEditing && variant === 'list');

  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) auto', alignItems: 'start', gap: 6 }}>
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
              // 矢印キー等でブロック間を移動しただけのblurでは、末尾ブロックを増やさない
              // （編集領域そのものから離れた場合だけ、次に書き続けられるよう空ブロックを確保する）。
              if (variant === 'text' && isLast && draft.trim() !== '' && !internalFocusMoveRef?.current) {
                onEnsureTrailingBlock?.(todo.id);
              }
            }}
            onBeforeInput={handleBeforeInput}
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
          // リストモード: 通常時はテキスト表示。デスクトップはクリックで編集開始、
          // モバイルはタップをバブルアップさせてカードのメニューを開く。
          <div
            onClick={() => {
              if (isMobile) return;
              pendingFocusRef.current = 'end';
              setIsListEditing(true);
            }}
            className="text-[13.5px]"
            style={{
              cursor: isMobile ? 'default' : 'text',
              color: draft ? 'var(--c-text-1)' : 'var(--c-text-3)',
              lineHeight: '1.55',
              padding: 0,
              minHeight: isMobile ? undefined : '1.55em',
              wordBreak: 'break-word',
              whiteSpace: 'pre-wrap',
              display: isMobile ? 'inline-block' : 'block',
            }}
          >
            {draft || (isMobile ? '' : 'クリックして編集')}
          </div>
        )}
        {!isMobile && onMoveToDone && (
          <div
            onClick={e => e.stopPropagation()}
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

      {!isMobile && (
        <button
          type="button"
          disabled={busy}
          onClick={(e) => { e.stopPropagation(); onDeleteBlock(todo.id, false); }}
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
      )}
    </div>
  );
}
