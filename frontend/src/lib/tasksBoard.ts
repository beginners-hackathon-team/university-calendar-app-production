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

export type DeadlineTone = 'danger' | 'warning' | 'notice' | 'muted';

export type DeadlineMeta = {
  label: string;
  tone: DeadlineTone;
  rank: number;
};

export type BoardVisible = Record<ColumnKey, boolean>;

// ドラッグ中アイテムの識別子（DnD の active.id / over.id に使う）。
export type DragItem =
  | { kind: 'assignment'; id: string }
  | { kind: 'todo'; id: string }
  | { kind: 'done'; doneKind: 'assignment' | 'todo'; id: string }
  | { kind: 'column'; column: ColumnKey };

// ---- スタイル定数 ---------------------------------------------------

// 落ち着いた中で少し濃いめのトーン。
export const toneStyles: Record<DeadlineTone, { color: string; background: string; border: string }> = {
  danger: { color: '#B0454F', background: '#F6E7E9', border: 'transparent' },
  warning: { color: '#9A7236', background: '#F5EDDD', border: 'transparent' },
  notice: { color: '#4F689C', background: '#EAEEF6', border: 'transparent' },
  muted: { color: 'var(--c-text-3)', background: '#F1F2F4', border: 'transparent' },
};

export const assignmentSortOptions: { value: AssignmentSortMode; label: string }[] = [
  { value: 'deadline-asc', label: '期限が近い順' },
  { value: 'course', label: '授業別' },
];

export const columnLabels: Record<ColumnKey, string> = {
  assignment: '課題',
  todo: 'TODO',
  done: '完了',
};

// 期限が「1週間以内」(rank<=3) の課題は TODO カラムにも表示する閾値。
export const TODO_VISIBLE_DEADLINE_RANK = 3;

// ---- localStorage キー ----------------------------------------------

const ASSIGNMENT_SORT_KEY = 'ku-assignment-sort-mode';
const BOARD_VISIBLE_KEY = 'ku-board-visible';
const BOARD_ORDER_KEY = 'ku-board-order';
const TODO_ORDER_KEY = 'ku-todo-order';
const ASSIGNMENT_TODO_PINS_KEY = 'ku-assignment-todo-pins';
const ASSIGNMENT_KEEP_KEY = 'ku-assignment-keep';
const COLUMN_WIDTHS_KEY = 'ku-board-widths';

export const DEFAULT_COLUMN_WIDTH = 360;
export const MIN_COLUMN_WIDTH = 240;
export const MAX_COLUMN_WIDTH = 760;

const DEFAULT_VISIBLE: BoardVisible = { assignment: false, todo: true, done: false };
const DEFAULT_ORDER: ColumnKey[] = ['assignment', 'todo', 'done'];

// ---- 日付・期限ヘルパ ------------------------------------------------

export function parseTaskDate(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value.replace(/\//g, '-').replace(' ', 'T'));
  return Number.isNaN(parsed) ? null : parsed;
}

export function getDeadlineMeta(until: string | null | undefined): DeadlineMeta {
  const parsed = parseTaskDate(until);
  if (parsed === null) return { label: '期限なし', tone: 'muted', rank: 5 };

  const diffDays = (parsed - Date.now()) / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return { label: '期限切れ', tone: 'muted', rank: 0 };
  if (diffDays < 1) return { label: '今日まで', tone: 'danger', rank: 1 };
  if (diffDays < 3) return { label: '3日以内', tone: 'warning', rank: 2 };
  if (diffDays < 7) return { label: '1週間以内', tone: 'notice', rank: 3 };
  return { label: '余裕あり', tone: 'muted', rank: 4 };
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
  const ma = getDeadlineMeta(a.availability_end);
  const mb = getDeadlineMeta(b.availability_end);
  return ma.rank - mb.rank
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
    const label = assignment.course_name?.trim() || '授業未設定';
    const items = groups.get(label) ?? [];
    items.push(assignment);
    groups.set(label, items);
  }
  return Array.from(groups.entries())
    .map(([label, items]) => ({ label, items: items.sort(compareAssignmentByDeadlineAsc) }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ja'));
}

export function buildAssignmentHref(
  assignment: Assignment,
  systemTypes: Record<string, string | null>,
): string | undefined {
  return assignment.lms_course_id
    ? buildAcanthusSsoUrl(assignment.lms_course_id, systemTypes[assignment.lms_course_id] ?? '')
    : undefined;
}

// ---- TODO の順序適用 ------------------------------------------------

// localStorage に保存した id 配列の順で並べ、未知の id（新規TODO）は末尾へ。
export function applyTodoOrder(todos: Todo[], order: string[]): Todo[] {
  if (order.length === 0) return todos;
  const rank = new Map(order.map((id, index) => [id, index]));
  return [...todos].sort((a, b) => {
    const ra = rank.has(a.id) ? rank.get(a.id)! : Number.MAX_SAFE_INTEGER;
    const rb = rank.has(b.id) ? rank.get(b.id)! : Number.MAX_SAFE_INTEGER;
    if (ra !== rb) return ra - rb;
    return parseTaskDate(a.created_at)! - parseTaskDate(b.created_at)!;
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

export function loadTodoOrder(): string[] {
  try {
    const raw = localStorage.getItem(TODO_ORDER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export function saveTodoOrder(order: string[]): void {
  try {
    localStorage.setItem(TODO_ORDER_KEY, JSON.stringify(order));
  } catch {
    // 無視
  }
}

export function loadAssignmentTodoPins(): string[] {
  try {
    const raw = localStorage.getItem(ASSIGNMENT_TODO_PINS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export function saveAssignmentTodoPins(ids: string[]): void {
  try {
    localStorage.setItem(ASSIGNMENT_TODO_PINS_KEY, JSON.stringify(ids));
  } catch {
    // 無視
  }
}

// 手動で課題画面に戻した課題（期限1週間以内でも自動でTODOへ移動させない）。
export function loadAssignmentKeep(): string[] {
  try {
    const raw = localStorage.getItem(ASSIGNMENT_KEEP_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export function saveAssignmentKeep(ids: string[]): void {
  try {
    localStorage.setItem(ASSIGNMENT_KEEP_KEY, JSON.stringify(ids));
  } catch {
    // 無視
  }
}

export function clampColumnWidth(width: number): number {
  return Math.max(MIN_COLUMN_WIDTH, Math.min(MAX_COLUMN_WIDTH, Math.round(width)));
}

export function loadColumnWidths(): Partial<Record<ColumnKey, number>> {
  try {
    const raw = localStorage.getItem(COLUMN_WIDTHS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const result: Partial<Record<ColumnKey, number>> = {};
    for (const key of ['assignment', 'todo', 'done'] as ColumnKey[]) {
      const value = parsed[key];
      if (typeof value === 'number' && Number.isFinite(value)) result[key] = clampColumnWidth(value);
    }
    return result;
  } catch {
    return {};
  }
}

export function saveColumnWidths(widths: Partial<Record<ColumnKey, number>>): void {
  try {
    localStorage.setItem(COLUMN_WIDTHS_KEY, JSON.stringify(widths));
  } catch {
    // 無視
  }
}
