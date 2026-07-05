import { useLayoutEffect, useRef, type KeyboardEvent } from 'react';

export type CaretPos = 'start' | 'end';
export type TodoBlockVariant = 'text' | 'list';
// 課題ブロックの外部からのフォーカス先（省略時は課題タイトル）。
export type AssignmentFocusField = 'course' | 'title' | 'deadline';

// 内容に合わせて高さを自動調整する textarea 用フック（編集可・読み取り専用どちらでも使う）。
export function useAutoGrowTextarea(value: string) {
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
export function blockMutatingKeys(e: KeyboardEvent<HTMLTextAreaElement>): boolean {
  if (NON_EDITABLE_KEYS.has(e.key)) {
    e.preventDefault();
    return true;
  }
  return false;
}

// 「カーソルがある行（前後の改行に挟まれた範囲）が空かどうか」を判定する。
// Enter を押したときに「同じブロック内で改行する」か「次のブロックを作る」かの分岐に使う
// （カーソルより前だけを見ると、行の途中で改行を入れたときに誤判定するため、行全体を見る）。
export function isCurrentLineEmpty(value: string, caretStart: number): boolean {
  const lineStart = value.lastIndexOf('\n', caretStart - 1) + 1;
  const lineEndIdx = value.indexOf('\n', caretStart);
  return value.slice(lineStart, lineEndIdx === -1 ? value.length : lineEndIdx) === '';
}

export const nonEditableTextareaHandlers = {
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
export function isOnFirstVisualLine(el: HTMLTextAreaElement): boolean {
  return !el.value.slice(0, el.selectionStart ?? 0).includes('\n');
}
export function isOnLastVisualLine(el: HTMLTextAreaElement): boolean {
  return !el.value.slice(el.selectionEnd ?? el.value.length).includes('\n');
}
export function focusTextareaAt(el: HTMLTextAreaElement | null, pos: 'start' | 'end') {
  if (!el) return;
  el.focus();
  const index = pos === 'start' ? 0 : el.value.length;
  el.setSelectionRange(index, index);
}
