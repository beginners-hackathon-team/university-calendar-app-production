import type { Assignment, Todo } from '../api/tasks';
import { buildAcanthusSsoUrl } from './universityUrls';

// ---- 型 -------------------------------------------------------------

export type ColumnKey = 'assignment' | 'todo' | 'done';

export type DoneItem =
  | { kind: 'assignment'; data: Assignment }
  | { kind: 'todo'; data: Todo };

// 課題カラムの並び替えは要件どおり「期限が近い順」「授業別」の2種のみ。
export type AssignmentSortMode = 'deadline-asc' | 'course';

export type AssignmentGroup = {
  label: string;
  items: Assignment[];
};

export type BoardVisible = Record<ColumnKey, boolean>;

// TODOカラムの表示モード。
export type TodoViewMode = 'list' | 'text';

// TODOカラムに表示するアイテム（TODO本体 / TODOへ送られた課題）の共通表現。
// 課題データを潰して TODO 型に変換せず、元の Assignment をそのまま保持する。
export type TodoColumnItem =
  | { type: 'todo'; todo: Todo }
  | { type: 'assignment'; assignment: Assignment };

// ---- スタイル定数 ---------------------------------------------------

export const assignmentSortOptions: { value: AssignmentSortMode; label: string }[] = [
  { value: 'deadline-asc', label: '期限が近い順' },
  { value: 'course', label: '授業別' },
];

export const columnLabels: Record<ColumnKey, string> = {
  assignment: '課題',
  todo: 'TODO',
  done: '完了',
};

// ---- localStorage キー ----------------------------------------------

const ASSIGNMENT_SORT_KEY = 'ku-assignment-sort-mode';
const BOARD_VISIBLE_KEY = 'ku-board-visible';
const BOARD_ORDER_KEY = 'ku-board-order';
const COLUMN_SHARES_KEY = 'ku-board-shares';
const TODO_COLUMN_ORDER_KEY = 'ku-todo-column-order';
const TODO_COLUMN_ASSIGNMENTS_KEY = 'ku-todo-column-assignments';
const TODO_VIEW_MODE_KEY = 'ku-todo-view-mode';

// 列の幅は固定px ではなく、表示中の列同士で分け合う比率（flex-grow の重み）として持つ。
// 列の表示/非表示が切り替わるたびに等分（1:1:1 など）へリセットされる。
export const DEFAULT_COLUMN_SHARE = 1;
// リサイズ時、隣接ペアの一方が縮みすぎないようにする下限比率。
export const MIN_SHARE_FRACTION = 0.15;

const DEFAULT_VISIBLE: BoardVisible = { assignment: false, todo: true, done: false };
const DEFAULT_ORDER: ColumnKey[] = ['assignment', 'todo', 'done'];

// ---- 日付・期限ヘルパ ------------------------------------------------

export function parseTaskDate(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value.replace(/\//g, '-').replace(' ', 'T'));
  return Number.isNaN(parsed) ? null : parsed;
}

// 課題の並び替え用ランク（0=期限切れ … 5=期限なし、小さいほど優先表示）。
export function getDeadlineRank(until: string | null | undefined): number {
  const parsed = parseTaskDate(until);
  if (parsed === null) return 5;
  const diffDays = (parsed - Date.now()) / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return 0;
  if (diffDays < 1) return 1;
  if (diffDays < 3) return 2;
  if (diffDays < 7) return 3;
  return 4;
}

export type RemainingDeadline = {
  label: string;
  color: string;
};

const REMAINING_DAY_MS = 24 * 60 * 60 * 1000;
const REMAINING_WEEK_MS = 7 * REMAINING_DAY_MS;
const REMAINING_DANGER_COLOR = 'var(--c-danger)';
const REMAINING_WARNING_COLOR = '#B8860B';

// 課題カード・TODOテキストモードで使う「残り期限」の相対表記（例: あと3日 5時間）。
export function formatRemainingDeadline(until: string | null | undefined): RemainingDeadline {
  const parsed = parseTaskDate(until);
  if (parsed === null) return { label: '期限なし', color: 'var(--c-text-3)' };

  const diffMs = parsed - Date.now();
  if (diffMs <= 0) return { label: '期限切れ', color: REMAINING_DANGER_COLOR };

  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);

  const label = days > 0
    ? (hours > 0 ? `あと${days}日 ${hours}時間` : `あと${days}日`)
    : (hours > 0 ? `あと${hours}時間` : 'あと1時間未満');

  const color = diffMs <= REMAINING_DAY_MS
    ? REMAINING_DANGER_COLOR
    : diffMs <= REMAINING_WEEK_MS
      ? REMAINING_WARNING_COLOR
      : 'var(--c-text-1)';

  return { label, color };
}

export function formatDateTime(value: string | null | undefined): string | null {
  const parsed = parseTaskDate(value);
  if (parsed === null) return value ?? null;
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

export function getDoneTime(item: DoneItem): number {
  return parseTaskDate(item.data.done_at) ?? 0;
}

// ---- 課題の並び替え・グルーピング ------------------------------------

function getDeadlineSortValue(assignment: Assignment): number {
  return parseTaskDate(assignment.availability_end) ?? Infinity;
}

export function compareAssignmentByDeadlineAsc(a: Assignment, b: Assignment): number {
  return getDeadlineRank(a.availability_end) - getDeadlineRank(b.availability_end)
    || getDeadlineSortValue(a) - getDeadlineSortValue(b)
    || a.task_name.localeCompare(b.task_name, 'ja');
}

export function sortAssignments(assignments: Assignment[], mode: AssignmentSortMode): Assignment[] {
  const rows = [...assignments];
  if (mode === 'course') {
    return rows.sort((a, b) => {
      const courseA = a.course_name?.trim() || '授業未設定';
      const courseB = b.course_name?.trim() || '授業未設定';
      return courseA.localeCompare(courseB, 'ja') || compareAssignmentByDeadlineAsc(a, b);
    });
  }
  return rows.sort(compareAssignmentByDeadlineAsc);
}

export function groupAssignmentsByCourse(assignments: Assignment[]): AssignmentGroup[] {
  const groups = new Map<string, Assignment[]>();
  for (const assignment of assignments) {
    const label = formatCourseName(assignment.course_name) || '授業未設定';
    const items = groups.get(label) ?? [];
    items.push(assignment);
    groups.set(label, items);
  }
  return Array.from(groups.entries())
    .map(([label, items]) => ({ label, items: items.sort(compareAssignmentByDeadlineAsc) }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ja'));
}

// LMSの授業名に含まれるかっこ書き（担当教員・教室コード・開講区分など）を取り除いて表示する。
// 例: 「グローバルキャリアデザイン論(Q2)（11016） (2026-前期-火-3)」→「グローバルキャリアデザイン論(Q2)」
// かっこの中身がQ1〜Q4の学期表記だけの場合はそのまま残し、Q表記が他の情報と混在する場合はQ部分だけ残す。
const BRACKET_RE = /[(（]([^()（）]*)[)）]/g;
const QUARTER_TOKEN_RE = /Q[1-4]/gi;

export function formatCourseName(name: string | null | undefined): string {
  if (!name) return '';
  const formatted = name.replace(BRACKET_RE, (whole, inner: string) => {
    const quarters = inner.match(QUARTER_TOKEN_RE);
    if (!quarters) return '';
    const rest = inner.replace(QUARTER_TOKEN_RE, '').trim();
    return rest === '' ? whole : `(${quarters.join('')})`;
  });
  return formatted.replace(/\s{2,}/g, ' ').trim();
}

export function buildAssignmentHref(
  assignment: Assignment,
  systemTypes: Record<string, string | null>,
): string | undefined {
  return assignment.lms_course_id
    ? buildAcanthusSsoUrl(assignment.lms_course_id, systemTypes[assignment.lms_course_id] ?? '')
    : undefined;
}

// ---- TODOカラムの並び順適用 -------------------------------------------

// TodoColumnItem を一意に識別する order キー（'todo:<id>' / 'assignment:<id>'）。
export function todoColumnItemKey(item: TodoColumnItem): string {
  return item.type === 'todo' ? `todo:${item.todo.id}` : `assignment:${item.assignment.id}`;
}

function getTodoColumnItemCreatedAt(item: TodoColumnItem): number {
  return parseTaskDate(item.type === 'todo' ? item.todo.created_at : item.assignment.created_at) ?? 0;
}

// localStorage に保存した order キー配列の順で並べ、未知のキー（新規追加分）は作成日時順で末尾へ。
export function applyTodoColumnOrder(items: TodoColumnItem[], order: string[]): TodoColumnItem[] {
  if (order.length === 0) return items;
  const rank = new Map(order.map((key, index) => [key, index]));
  return [...items].sort((a, b) => {
    const ra = rank.has(todoColumnItemKey(a)) ? rank.get(todoColumnItemKey(a))! : Number.MAX_SAFE_INTEGER;
    const rb = rank.has(todoColumnItemKey(b)) ? rank.get(todoColumnItemKey(b))! : Number.MAX_SAFE_INTEGER;
    if (ra !== rb) return ra - rb;
    return getTodoColumnItemCreatedAt(a) - getTodoColumnItemCreatedAt(b);
  });
}

// ---- localStorage 読み書き（read 失敗時は既定値へフォールバック）------

function isAssignmentSortMode(value: string | null): value is AssignmentSortMode {
  return value === 'deadline-asc' || value === 'course';
}

export function loadAssignmentSortMode(): AssignmentSortMode {
  try {
    const saved = localStorage.getItem(ASSIGNMENT_SORT_KEY);
    return isAssignmentSortMode(saved) ? saved : 'deadline-asc';
  } catch {
    return 'deadline-asc';
  }
}

export function saveAssignmentSortMode(mode: AssignmentSortMode): void {
  try {
    localStorage.setItem(ASSIGNMENT_SORT_KEY, mode);
  } catch {
    // localStorage が使えない環境では、この表示中だけ反映する。
  }
}

export function loadBoardVisible(): BoardVisible {
  try {
    const raw = localStorage.getItem(BOARD_VISIBLE_KEY);
    if (!raw) return { ...DEFAULT_VISIBLE };
    const parsed = JSON.parse(raw) as Partial<BoardVisible>;
    return {
      assignment: typeof parsed.assignment === 'boolean' ? parsed.assignment : DEFAULT_VISIBLE.assignment,
      todo: typeof parsed.todo === 'boolean' ? parsed.todo : DEFAULT_VISIBLE.todo,
      done: typeof parsed.done === 'boolean' ? parsed.done : DEFAULT_VISIBLE.done,
    };
  } catch {
    return { ...DEFAULT_VISIBLE };
  }
}

export function saveBoardVisible(visible: BoardVisible): void {
  try {
    localStorage.setItem(BOARD_VISIBLE_KEY, JSON.stringify(visible));
  } catch {
    // 無視
  }
}

function isColumnKey(value: unknown): value is ColumnKey {
  return value === 'assignment' || value === 'todo' || value === 'done';
}

export function loadBoardOrder(): ColumnKey[] {
  try {
    const raw = localStorage.getItem(BOARD_ORDER_KEY);
    if (!raw) return [...DEFAULT_ORDER];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [...DEFAULT_ORDER];
    const cleaned = parsed.filter(isColumnKey);
    // 既定の全カラムが含まれるよう、欠けているものを補完する。
    for (const key of DEFAULT_ORDER) {
      if (!cleaned.includes(key)) cleaned.push(key);
    }
    return cleaned;
  } catch {
    return [...DEFAULT_ORDER];
  }
}

export function saveBoardOrder(order: ColumnKey[]): void {
  try {
    localStorage.setItem(BOARD_ORDER_KEY, JSON.stringify(order));
  } catch {
    // 無視
  }
}

// TODOカラム内の並び順（TODO本体・TODOへ送られた課題を含む order キー配列）。
export function loadTodoColumnOrder(): string[] {
  try {
    const raw = localStorage.getItem(TODO_COLUMN_ORDER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export function saveTodoColumnOrder(order: string[]): void {
  try {
    localStorage.setItem(TODO_COLUMN_ORDER_KEY, JSON.stringify(order));
  } catch {
    // 無視
  }
}

// TODOカラムへユーザーが送った課題のID一覧（自動移動はせず、すべて手動操作で管理する）。
export function loadTodoColumnAssignmentIds(): string[] {
  try {
    const raw = localStorage.getItem(TODO_COLUMN_ASSIGNMENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export function saveTodoColumnAssignmentIds(ids: string[]): void {
  try {
    localStorage.setItem(TODO_COLUMN_ASSIGNMENTS_KEY, JSON.stringify(ids));
  } catch {
    // 無視
  }
}

function isTodoViewMode(value: string | null): value is TodoViewMode {
  return value === 'list' || value === 'text';
}

export function loadTodoViewMode(): TodoViewMode {
  try {
    const saved = localStorage.getItem(TODO_VIEW_MODE_KEY);
    return isTodoViewMode(saved) ? saved : 'text';
  } catch {
    return 'text';
  }
}

export function saveTodoViewMode(mode: TodoViewMode): void {
  try {
    localStorage.setItem(TODO_VIEW_MODE_KEY, mode);
  } catch {
    // 無視
  }
}

// ---- 課題・完了カラムの並び順 ----------------------------------------

export function doneColumnItemKey(item: DoneItem): string {
  return `${item.kind}:${item.data.id}`;
}

// 課題カラムの手動並び順（ID配列）。order が空の場合は fallbackMode で並べる。
export function applyAssignmentColumnOrder(
  assignments: Assignment[],
  order: string[],
  fallbackMode: AssignmentSortMode,
): Assignment[] {
  const fallbackSorted = sortAssignments(assignments, fallbackMode);
  if (order.length === 0) return fallbackSorted;
  const rank = new Map(order.map((id, idx) => [id, idx]));
  const fallbackRank = new Map(fallbackSorted.map((a, idx) => [a.id, idx]));
  return [...assignments].sort((a, b) => {
    const ra = rank.has(a.id) ? rank.get(a.id)! : Number.MAX_SAFE_INTEGER;
    const rb = rank.has(b.id) ? rank.get(b.id)! : Number.MAX_SAFE_INTEGER;
    if (ra !== rb) return ra - rb;
    return (fallbackRank.get(a.id) ?? 0) - (fallbackRank.get(b.id) ?? 0);
  });
}

// 完了カラムの手動並び順（"kind:id" キー配列）。order が空の場合は done_at 降順。
export function applyDoneColumnOrder(items: DoneItem[], order: string[]): DoneItem[] {
  if (order.length === 0) return items;
  const rank = new Map(order.map((key, idx) => [key, idx]));
  return [...items].sort((a, b) => {
    const ra = rank.has(doneColumnItemKey(a)) ? rank.get(doneColumnItemKey(a))! : Number.MAX_SAFE_INTEGER;
    const rb = rank.has(doneColumnItemKey(b)) ? rank.get(doneColumnItemKey(b))! : Number.MAX_SAFE_INTEGER;
    if (ra !== rb) return ra - rb;
    return getDoneTime(b) - getDoneTime(a);
  });
}

const ASSIGNMENT_COLUMN_ORDER_KEY = 'ku-assignment-column-order';
const DONE_COLUMN_ORDER_KEY = 'ku-done-column-order';

export function loadAssignmentColumnOrder(): string[] {
  try {
    const raw = localStorage.getItem(ASSIGNMENT_COLUMN_ORDER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export function saveAssignmentColumnOrder(order: string[]): void {
  try {
    localStorage.setItem(ASSIGNMENT_COLUMN_ORDER_KEY, JSON.stringify(order));
  } catch {
    // 無視
  }
}

export function loadDoneColumnOrder(): string[] {
  try {
    const raw = localStorage.getItem(DONE_COLUMN_ORDER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export function saveDoneColumnOrder(order: string[]): void {
  try {
    localStorage.setItem(DONE_COLUMN_ORDER_KEY, JSON.stringify(order));
  } catch {
    // 無視
  }
}

export function loadColumnShares(): Partial<Record<ColumnKey, number>> {
  try {
    const raw = localStorage.getItem(COLUMN_SHARES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const result: Partial<Record<ColumnKey, number>> = {};
    for (const key of ['assignment', 'todo', 'done'] as ColumnKey[]) {
      const value = parsed[key];
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) result[key] = value;
    }
    return result;
  } catch {
    return {};
  }
}

export function saveColumnShares(shares: Partial<Record<ColumnKey, number>>): void {
  try {
    localStorage.setItem(COLUMN_SHARES_KEY, JSON.stringify(shares));
  } catch {
    // 無視
  }
}
