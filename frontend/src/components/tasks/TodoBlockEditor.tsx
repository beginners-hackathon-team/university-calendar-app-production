import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Todo } from '../../api/tasks';

export type CaretPos = 'start' | 'end';

type Props = {
  todo: Todo;
  busy: boolean;
  autoFocus: boolean;
  caret: CaretPos;
  onConsumeFocus: () => void;
  onChangeTitle: (id: string, title: string) => void;
  onCreateBelow: (afterId: string) => void;
  onDeleteBlock: (id: string, focusPrev: boolean) => void;
  onNavigate: (id: string, dir: 'prev' | 'next') => void;
};

// 1 ブロック = 1 TODO。テキストエディタのように改行・カーソル移動でき、空行で次のブロックを作る。
export default function TodoBlockEditor({
  todo,
  busy,
  autoFocus,
  caret,
  onConsumeFocus,
  onChangeTitle,
  onCreateBelow,
  onDeleteBlock,
  onNavigate,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `todo:${todo.id}`,
    data: { type: 'todo', id: todo.id },
  });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState(todo.title);
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const debounceRef = useRef<number | null>(null);

  // 外部からタイトルが変わったら（編集中でなければ）同期する。
  useEffect(() => {
    if (!focused) setDraft(todo.title);
  }, [todo.title, focused]);

  // 内容に合わせて高さを自動調整する。
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [draft]);

  // 新規作成・削除・矢印移動時のフォーカス移譲。
  useEffect(() => {
    if (!autoFocus) return;
    const el = textareaRef.current;
    if (el) {
      el.focus();
      const pos = caret === 'start' ? 0 : el.value.length;
      el.setSelectionRange(pos, pos);
    }
    onConsumeFocus();
  }, [autoFocus, caret, onConsumeFocus]);

  const commit = (value: string) => {
    if (value !== todo.title) onChangeTitle(todo.id, value);
  };

  const scheduleCommit = (value: string) => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => commit(value), 300);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    const caretStart = el.selectionStart;
    const collapsed = el.selectionStart === el.selectionEnd;

    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      const before = draft.slice(0, caretStart);
      const currentLineEmpty = before === '' || before.endsWith('\n');
      if (currentLineEmpty) {
        // 空行で Enter → このブロックを確定し、新しいブロックを作る。
        e.preventDefault();
        const cleaned = draft.replace(/\n+$/, '');
        setDraft(cleaned);
        commit(cleaned);
        onCreateBelow(todo.id);
      }
      // それ以外は通常の改行（行が増える）。
      return;
    }

    if (e.key === 'Backspace' && draft === '' && caretStart === 0) {
      // 空ブロックで Backspace → ブロック削除し前ブロックへフォーカス。
      e.preventDefault();
      onDeleteBlock(todo.id, true);
      return;
    }

    // 十字キーでブロック間を移動（テキストエディタのような感覚）。
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

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    display: 'grid',
    gridTemplateColumns: 'auto minmax(0, 1fr) auto',
    alignItems: 'start',
    gap: 6,
    padding: '5px 12px',
    background: '#fff',
  };

  const showHandles = hovered || focused;

  return (
    <div
      ref={setNodeRef}
      style={style}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span
        {...attributes}
        {...listeners}
        aria-label="ドラッグして並び替え"
        title="ドラッグして並び替え"
        style={{
          cursor: 'grab',
          color: 'var(--c-text-3)',
          fontSize: 14,
          lineHeight: '26px',
          touchAction: 'none',
          userSelect: 'none',
          opacity: showHandles ? 0.7 : 0,
          transition: 'opacity 0.12s',
        }}
      >
        ⠿
      </span>

      <textarea
        ref={textareaRef}
        value={draft}
        rows={1}
        placeholder="TODO を入力"
        onChange={e => {
          setDraft(e.target.value);
          scheduleCommit(e.target.value);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          if (debounceRef.current) window.clearTimeout(debounceRef.current);
          commit(draft);
        }}
        onKeyDown={handleKeyDown}
        className="text-[13.5px]"
        style={{
          width: '100%',
          resize: 'none',
          border: 'none',
          outline: 'none',
          background: 'transparent',
          color: 'var(--c-text-1)',
          lineHeight: '1.55',
          padding: '3px 0',
          fontFamily: 'inherit',
          overflow: 'hidden',
        }}
      />

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
          lineHeight: '26px',
          opacity: showHandles ? 0.7 : 0,
          transition: 'opacity 0.12s',
        }}
      >
        ×
      </button>
    </div>
  );
}
