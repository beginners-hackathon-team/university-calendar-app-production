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

// キャレット位置の計測に写す textarea のスタイル（幅・フォント・余白など、折り返し位置に影響するもの）。
const MIRROR_STYLE_PROPS = [
  'box-sizing', 'width', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
  'font-family', 'font-size', 'font-weight', 'font-style', 'letter-spacing', 'line-height',
  'text-transform', 'word-spacing', 'tab-size',
];

// textarea は文字がDOMノードとして存在しない（Range/getClientRects が使えない）ため、
// 同じスタイルを複製した非表示のdivにテキストを流し込み、キャレット位置に置いたマーカーの
// offsetTop を計測することで「実際に折り返された何行目か」を求める（テキストエリアの
// キャレット位置測定によく使われる定番の手法）。
function caretVisualRow(el: HTMLTextAreaElement, caretPos: number): { row: number; totalRows: number } {
  const style = window.getComputedStyle(el);
  const mirror = document.createElement('div');
  mirror.style.position = 'absolute';
  mirror.style.visibility = 'hidden';
  mirror.style.top = '0';
  mirror.style.left = '-9999px';
  mirror.style.whiteSpace = 'pre-wrap';
  mirror.style.wordWrap = 'break-word';
  mirror.style.overflowWrap = 'break-word';
  for (const prop of MIRROR_STYLE_PROPS) {
    mirror.style.setProperty(prop, style.getPropertyValue(prop));
  }

  mirror.appendChild(document.createTextNode(el.value.slice(0, caretPos)));
  const marker = document.createElement('span');
  // 末尾でも高さを測れるよう、キャレット以降のテキスト（無ければゼロ幅スペース）を続ける。
  marker.textContent = el.value.slice(caretPos) || '​';
  mirror.appendChild(marker);
  document.body.appendChild(mirror);

  const lineHeight = parseFloat(style.lineHeight) || marker.offsetHeight || 1;
  const row = Math.round(marker.offsetTop / lineHeight);
  const totalRows = Math.round(mirror.scrollHeight / lineHeight);

  document.body.removeChild(mirror);
  return { row, totalRows };
}

// テキストエリア内で「先頭行/最終行にいるか」を判定する（複数行に折り返している場合は
// その内部の移動を優先し、端まで来たときだけ隣の行（textarea）へ移動する）。
export function isOnFirstVisualLine(el: HTMLTextAreaElement): boolean {
  return caretVisualRow(el, el.selectionStart ?? 0).row <= 0;
}
export function isOnLastVisualLine(el: HTMLTextAreaElement): boolean {
  const { row, totalRows } = caretVisualRow(el, el.selectionEnd ?? el.value.length);
  return row >= totalRows - 1;
}
export function focusTextareaAt(el: HTMLTextAreaElement | null, pos: 'start' | 'end') {
  if (!el) return;
  el.focus();
  const index = pos === 'start' ? 0 : el.value.length;
  el.setSelectionRange(index, index);
}
