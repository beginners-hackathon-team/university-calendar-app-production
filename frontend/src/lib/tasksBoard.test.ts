import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Assignment, Todo } from '../api/tasks';
import {
  applyAssignmentColumnOrder,
  applyDoneColumnOrder,
  applyTodoColumnOrder,
  buildAssignmentHref,
  compareAssignmentByDeadlineAsc,
  doneColumnItemKey,
  filterAssignmentsByDeadline,
  formatCourseName,
  formatDateTime,
  formatRemainingDeadline,
  getDeadlineRank,
  getDoneTime,
  groupAssignmentsByCourse,
  loadAssignmentColumnOrder,
  loadAssignmentFilterMode,
  loadAssignmentSortMode,
  loadBoardOrder,
  loadBoardVisible,
  loadDoneColumnOrder,
  loadTodoColumnOrder,
  parseTaskDate,
  saveAssignmentColumnOrder,
  saveAssignmentFilterMode,
  saveAssignmentSortMode,
  saveBoardOrder,
  saveBoardVisible,
  saveDoneColumnOrder,
  saveTodoColumnOrder,
  sortAssignments,
  todoColumnItemKey,
} from './tasksBoard';

function makeAssignment(overrides: Partial<Assignment> = {}): Assignment {
  return {
    id: 'a-1',
    task_name: '課題',
    task_contents_id: '',
    course_name: null,
    submitted_at: null,
    result: '',
    score: null,
    kind: null,
    availability_start: null,
    availability_end: null,
    source_url: null,
    is_due_estimated: false,
    lms_course_id: null,
    is_active_url: false,
    board_status: 'assignment',
    is_done: false,
    done_at: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: 't-1',
    title: 'TODO',
    is_done: false,
    done_at: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe('parseTaskDate', () => {
  it('returns null for null/undefined', () => {
    expect(parseTaskDate(null)).toBeNull();
    expect(parseTaskDate(undefined)).toBeNull();
  });

  it('parses ISO date strings', () => {
    expect(parseTaskDate('2026-04-10T12:00:00')).toBe(new Date('2026-04-10T12:00:00').getTime());
  });

  it('parses slash-separated date strings', () => {
    expect(parseTaskDate('2026/04/10 12:00:00')).toBe(new Date('2026-04-10T12:00:00').getTime());
  });

  it('returns null for unparseable strings', () => {
    expect(parseTaskDate('not-a-date')).toBeNull();
  });
});

describe('getDeadlineRank / formatRemainingDeadline (time-dependent)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-10T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('ranks missing deadlines as 5 (lowest priority)', () => {
    expect(getDeadlineRank(null)).toBe(5);
  });

  it('ranks overdue deadlines as 0', () => {
    expect(getDeadlineRank('2026-04-09T00:00:00Z')).toBe(0);
  });

  it('ranks deadlines within a day as 1', () => {
    expect(getDeadlineRank('2026-04-10T12:00:00Z')).toBe(1);
  });

  it('ranks deadlines within 3 days as 2', () => {
    expect(getDeadlineRank('2026-04-12T00:00:00Z')).toBe(2);
  });

  it('ranks deadlines within a week as 3', () => {
    expect(getDeadlineRank('2026-04-15T00:00:00Z')).toBe(3);
  });

  it('ranks deadlines beyond a week as 4', () => {
    expect(getDeadlineRank('2026-05-01T00:00:00Z')).toBe(4);
  });

  it('formats missing deadline', () => {
    expect(formatRemainingDeadline(null)).toEqual({ label: '期限なし', color: 'var(--c-text-3)' });
  });

  it('formats an overdue deadline', () => {
    expect(formatRemainingDeadline('2026-04-09T00:00:00Z').label).toBe('期限切れ');
  });

  it('formats a deadline a few hours away', () => {
    const result = formatRemainingDeadline('2026-04-10T05:00:00Z');
    expect(result.label).toBe('あと5時間');
    expect(result.color).toBe('var(--c-danger)');
  });

  it('formats a deadline a few days away with a warning color', () => {
    const result = formatRemainingDeadline('2026-04-13T05:00:00Z');
    expect(result.label).toBe('あと3日 5時間');
    expect(result.color).toBe('#B8860B');
  });

  it('formats a deadline beyond a week with the normal color', () => {
    const result = formatRemainingDeadline('2026-05-01T00:00:00Z');
    expect(result.color).toBe('var(--c-text-1)');
  });
});

describe('formatDateTime', () => {
  it('returns null for missing values', () => {
    expect(formatDateTime(null)).toBeNull();
    expect(formatDateTime(undefined)).toBeNull();
  });

  it('falls back to the raw value when unparseable', () => {
    expect(formatDateTime('not-a-date')).toBe('not-a-date');
  });

  it('formats a valid date to month/day and time', () => {
    const formatted = formatDateTime('2026-04-10T12:30:00');
    expect(formatted).toMatch(/4/);
    expect(formatted).toMatch(/10/);
    expect(formatted).toMatch(/12/);
    expect(formatted).toMatch(/30/);
  });
});

describe('getDoneTime', () => {
  it('returns the parsed done_at timestamp', () => {
    const item = { kind: 'todo' as const, data: makeTodo({ done_at: '2026-04-10T00:00:00Z' }) };
    expect(getDoneTime(item)).toBe(new Date('2026-04-10T00:00:00Z').getTime());
  });

  it('returns 0 when done_at is missing', () => {
    const item = { kind: 'todo' as const, data: makeTodo({ done_at: null }) };
    expect(getDoneTime(item)).toBe(0);
  });
});

describe('sortAssignments / compareAssignmentByDeadlineAsc', () => {
  it('compares two assignments directly by deadline urgency', () => {
    const overdue = makeAssignment({ id: 'overdue', availability_end: '2020-01-01T00:00:00Z' });
    const noDeadline = makeAssignment({ id: 'none', availability_end: null });
    expect(compareAssignmentByDeadlineAsc(overdue, noDeadline)).toBeLessThan(0);
    expect(compareAssignmentByDeadlineAsc(noDeadline, overdue)).toBeGreaterThan(0);
    expect(compareAssignmentByDeadlineAsc(overdue, overdue)).toBe(0);
  });

  it('sorts by deadline ascending by default', () => {
    const soon = makeAssignment({ id: 'soon', task_name: 'B', availability_end: '2026-01-02T00:00:00Z' });
    const later = makeAssignment({ id: 'later', task_name: 'A', availability_end: '2026-06-01T00:00:00Z' });
    const sorted = sortAssignments([later, soon], 'deadline-asc');
    expect(sorted.map(a => a.id)).toEqual(['soon', 'later']);
  });

  it('breaks ties by task name in Japanese locale order', () => {
    const a = makeAssignment({ id: 'a', task_name: 'あ課題' });
    const b = makeAssignment({ id: 'b', task_name: 'い課題' });
    const sorted = sortAssignments([b, a], 'deadline-asc');
    expect(sorted.map(x => x.id)).toEqual(['a', 'b']);
  });

  it('sorts by course name first in course mode', () => {
    const a = makeAssignment({ id: 'a', course_name: 'Z講義', availability_end: '2026-01-01T00:00:00Z' });
    const b = makeAssignment({ id: 'b', course_name: 'A講義', availability_end: '2026-12-01T00:00:00Z' });
    const sorted = sortAssignments([a, b], 'course');
    expect(sorted.map(x => x.id)).toEqual(['b', 'a']);
  });

  it('treats missing course name as 授業未設定 in course mode', () => {
    const withCourse = makeAssignment({ id: 'with', course_name: 'あ講義' });
    const withoutCourse = makeAssignment({ id: 'without', course_name: null });
    const sorted = sortAssignments([withCourse, withoutCourse], 'course');
    // 「あ」は「授業未設定」より前に来る
    expect(sorted.map(x => x.id)).toEqual(['with', 'without']);
  });
});

describe('groupAssignmentsByCourse', () => {
  it('groups assignments by formatted course name and sorts groups alphabetically', () => {
    const groups = groupAssignmentsByCourse([
      makeAssignment({ id: '1', course_name: 'い講義' }),
      makeAssignment({ id: '2', course_name: 'あ講義' }),
      makeAssignment({ id: '3', course_name: null }),
    ]);
    expect(groups.map(g => g.label)).toEqual(['あ講義', 'い講義', '授業未設定']);
  });

  it('sorts items within a group by deadline', () => {
    const groups = groupAssignmentsByCourse([
      makeAssignment({ id: 'late', course_name: '講義', availability_end: '2026-12-01T00:00:00Z' }),
      makeAssignment({ id: 'soon', course_name: '講義', availability_end: '2026-01-01T00:00:00Z' }),
    ]);
    expect(groups[0]?.items.map(i => i.id)).toEqual(['soon', 'late']);
  });
});

describe('formatCourseName', () => {
  it('returns empty string for missing input', () => {
    expect(formatCourseName(null)).toBe('');
    expect(formatCourseName(undefined)).toBe('');
    expect(formatCourseName('')).toBe('');
  });

  it('leaves plain names without brackets unchanged', () => {
    expect(formatCourseName('データ構造とアルゴリズム')).toBe('データ構造とアルゴリズム');
  });

  it('keeps a bracket that contains only a quarter token', () => {
    expect(formatCourseName('授業名(Q1)')).toBe('授業名(Q1)');
  });

  it('removes brackets that contain no quarter token', () => {
    expect(formatCourseName('授業名（教室A）')).toBe('授業名');
  });

  it('keeps only the quarter token when a bracket mixes it with other text', () => {
    expect(formatCourseName('Course (Q1/newbuilding)')).toBe('Course (Q1)');
  });

  it('matches the documented example with multiple mixed brackets', () => {
    expect(
      formatCourseName('グローバルキャリアデザイン論(Q2)（11016） (2026-前期-火-3)'),
    ).toBe('グローバルキャリアデザイン論(Q2)');
  });
});

describe('buildAssignmentHref', () => {
  it('returns undefined when there is no lms_course_id', () => {
    expect(buildAssignmentHref(makeAssignment({ lms_course_id: null }), {})).toBeUndefined();
  });

  it('builds an SSO url using the course system type', () => {
    const href = buildAssignmentHref(
      makeAssignment({ lms_course_id: 'course-1' }),
      { 'course-1': 'webclass' },
    );
    expect(href).toContain('courseId=course-1');
    expect(href).toContain('systemType=webclass');
  });
});

describe('filterAssignmentsByDeadline', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-10T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns everything in "all" mode', () => {
    const noDeadline = makeAssignment({ id: 'none', availability_end: null });
    expect(filterAssignmentsByDeadline([noDeadline], 'all')).toEqual([noDeadline]);
  });

  it('excludes assignments without a deadline in "week" mode', () => {
    const noDeadline = makeAssignment({ id: 'none', availability_end: null });
    expect(filterAssignmentsByDeadline([noDeadline], 'week')).toEqual([]);
  });

  it('keeps only deadlines within a week in "week" mode', () => {
    const within = makeAssignment({ id: 'within', availability_end: '2026-04-12T00:00:00Z' });
    const beyond = makeAssignment({ id: 'beyond', availability_end: '2026-05-01T00:00:00Z' });
    expect(filterAssignmentsByDeadline([within, beyond], 'week').map(a => a.id)).toEqual(['within']);
  });
});

describe('todoColumnItemKey / doneColumnItemKey', () => {
  it('builds distinct keys per item type', () => {
    expect(todoColumnItemKey({ type: 'todo', todo: makeTodo({ id: '1' }) })).toBe('todo:1');
    expect(todoColumnItemKey({ type: 'assignment', assignment: makeAssignment({ id: '1' }) })).toBe('assignment:1');
    expect(doneColumnItemKey({ kind: 'todo', data: makeTodo({ id: '1' }) })).toBe('todo:1');
    expect(doneColumnItemKey({ kind: 'assignment', data: makeAssignment({ id: '1' }) })).toBe('assignment:1');
  });
});

describe('applyTodoColumnOrder', () => {
  it('returns items unchanged when there is no saved order', () => {
    const items = [
      { type: 'todo' as const, todo: makeTodo({ id: '1' }) },
      { type: 'todo' as const, todo: makeTodo({ id: '2' }) },
    ];
    expect(applyTodoColumnOrder(items, [])).toEqual(items);
  });

  it('respects the saved order and appends unknown items by creation time', () => {
    const older = { type: 'todo' as const, todo: makeTodo({ id: 'older', created_at: '2026-01-01T00:00:00Z' }) };
    const newer = { type: 'todo' as const, todo: makeTodo({ id: 'newer', created_at: '2026-02-01T00:00:00Z' }) };
    const ordered = { type: 'todo' as const, todo: makeTodo({ id: 'ordered' }) };

    const result = applyTodoColumnOrder([older, newer, ordered], ['todo:ordered']);
    expect(result.map(todoColumnItemKey)).toEqual(['todo:ordered', 'todo:older', 'todo:newer']);
  });
});

describe('applyAssignmentColumnOrder', () => {
  it('falls back to sortAssignments when there is no saved order', () => {
    const soon = makeAssignment({ id: 'soon', availability_end: '2026-01-01T00:00:00Z' });
    const later = makeAssignment({ id: 'later', availability_end: '2026-06-01T00:00:00Z' });
    const result = applyAssignmentColumnOrder([later, soon], [], 'deadline-asc');
    expect(result.map(a => a.id)).toEqual(['soon', 'later']);
  });

  it('respects a manual order over the fallback sort', () => {
    const a = makeAssignment({ id: 'a', availability_end: '2026-01-01T00:00:00Z' });
    const b = makeAssignment({ id: 'b', availability_end: '2026-02-01T00:00:00Z' });
    const result = applyAssignmentColumnOrder([a, b], ['b', 'a'], 'deadline-asc');
    expect(result.map(x => x.id)).toEqual(['b', 'a']);
  });
});

describe('applyDoneColumnOrder', () => {
  it('sorts by done_at descending when there is no saved order', () => {
    const earlierDone = { kind: 'todo' as const, data: makeTodo({ id: 'earlier', done_at: '2026-01-01T00:00:00Z' }) };
    const laterDone = { kind: 'todo' as const, data: makeTodo({ id: 'later', done_at: '2026-02-01T00:00:00Z' }) };
    const result = applyDoneColumnOrder([earlierDone, laterDone], []);
    expect(result.map(doneColumnItemKey)).toEqual(['todo:later', 'todo:earlier']);
  });

  it('respects a manual order', () => {
    const a = { kind: 'todo' as const, data: makeTodo({ id: 'a' }) };
    const b = { kind: 'todo' as const, data: makeTodo({ id: 'b' }) };
    const result = applyDoneColumnOrder([a, b], ['todo:b', 'todo:a']);
    expect(result.map(doneColumnItemKey)).toEqual(['todo:b', 'todo:a']);
  });

  it('falls back to done_at descending for items missing from the order', () => {
    const ordered = { kind: 'todo' as const, data: makeTodo({ id: 'ordered' }) };
    const earlier = { kind: 'todo' as const, data: makeTodo({ id: 'earlier', done_at: '2026-01-01T00:00:00Z' }) };
    const later = { kind: 'todo' as const, data: makeTodo({ id: 'later', done_at: '2026-02-01T00:00:00Z' }) };

    const result = applyDoneColumnOrder([earlier, later, ordered], ['todo:ordered']);
    expect(result.map(doneColumnItemKey)).toEqual(['todo:ordered', 'todo:later', 'todo:earlier']);
  });
});

describe('localStorage read/write helpers', () => {
  it('round-trips the assignment sort mode', () => {
    expect(loadAssignmentSortMode()).toBe('deadline-asc');
    saveAssignmentSortMode('course');
    expect(loadAssignmentSortMode()).toBe('course');
  });

  it('falls back to the default sort mode for corrupted storage', () => {
    localStorage.setItem('ku-assignment-sort-mode', 'not-a-valid-mode');
    expect(loadAssignmentSortMode()).toBe('deadline-asc');
  });

  it('round-trips the assignment filter mode', () => {
    expect(loadAssignmentFilterMode()).toBe('week');
    saveAssignmentFilterMode('all');
    expect(loadAssignmentFilterMode()).toBe('all');
  });

  it('round-trips board visibility and coerces invalid fields to defaults', () => {
    saveBoardVisible({ assignment: true, todo: false, done: true });
    expect(loadBoardVisible()).toEqual({ assignment: true, todo: false, done: true });

    localStorage.setItem('ku-board-visible', JSON.stringify({ assignment: 'yes', todo: false }));
    expect(loadBoardVisible()).toEqual({ assignment: false, todo: false, done: false });
  });

  it('completes a partial board order with the missing default columns', () => {
    saveBoardOrder(['done']);
    expect(loadBoardOrder()).toEqual(['done', 'assignment', 'todo']);
  });

  it('returns the default board order when nothing is saved', () => {
    expect(loadBoardOrder()).toEqual(['assignment', 'todo', 'done']);
  });

  it.each([
    ['todo column order', saveTodoColumnOrder, loadTodoColumnOrder],
    ['assignment column order', saveAssignmentColumnOrder, loadAssignmentColumnOrder],
    ['done column order', saveDoneColumnOrder, loadDoneColumnOrder],
  ] as const)('round-trips %s independently of the others', (_label, save, load) => {
    expect(load()).toEqual([]);
    save(['x', 'y']);
    expect(load()).toEqual(['x', 'y']);
  });
});
