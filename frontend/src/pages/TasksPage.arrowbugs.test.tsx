import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TasksPage from './TasksPage';
import type { Todo } from '../api/tasks';

// ユーザー報告の3つの挙動を再現する:
// 1. 行の先頭で改行すると、以降改行できなくなる？
// 2. 最終行でArrowUpするとブロックが増えてしまう
// 3. 最終行で改行してブロックを作ると、後ろではなく前にできる
vi.mock('../api/tasks', () => ({
  fetchAssignments: vi.fn().mockResolvedValue([]),
  fetchLmsSystemTypes: vi.fn().mockResolvedValue({}),
  fetchTodos: vi.fn(),
  createTodo: vi.fn(),
  updateTodo: vi.fn().mockResolvedValue({}),
  deleteTodo: vi.fn(),
  updateAssignmentBoardStatus: vi.fn(),
  updateAssignmentTitle: vi.fn(),
  deleteAssignment: vi.fn(),
}));

function installMatchMediaMock() {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

let nextId = 100;

async function setupTwoTodos() {
  const { fetchTodos, createTodo } = await import('../api/tasks');
  vi.mocked(fetchTodos).mockResolvedValueOnce([
    { id: 'todo-1', title: 'todo one', is_done: false, done_at: null, created_at: 'now' },
    { id: 'todo-2', title: 'todo two', is_done: false, done_at: null, created_at: 'now' },
  ]);
  vi.mocked(createTodo).mockImplementation(async (title: string) => ({
    id: `todo-new-${nextId++}`,
    title,
    is_done: false,
    done_at: null,
    created_at: 'now',
  }));
  render(<TasksPage />);
  await screen.findByDisplayValue('todo one');
  return screen.findByDisplayValue('todo two') as Promise<HTMLTextAreaElement>;
}

describe('TODOテキストモード: Arrow/Enterの不具合再現', () => {
  beforeEach(() => {
    installMatchMediaMock();
    localStorage.setItem('ku-todo-view-mode', 'text');
    vi.clearAllMocks();
    nextId = 100;
  });

  it('最終行でArrowUpしても新しいブロックが増えない', async () => {
    const last = await setupTwoTodos();
    const before = screen.getAllByRole('textbox').length;

    last.focus();
    await userEvent.keyboard('{ArrowUp}');

    // ArrowUpでフォーカスが前のブロックへ移っても、ブロック数は変わらないはず。
    await waitFor(() => {
      expect(screen.getAllByRole('textbox').length).toBe(before);
    });
  });

  it('行の先頭で改行しても、その後も改行し続けられる', async () => {
    const last = await setupTwoTodos();
    last.focus();
    last.setSelectionRange(0, 0);

    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(last.value).toBe('\ntodo two'));

    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(last.value).toBe('\n\ntodo two'));

    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(last.value).toBe('\n\n\ntodo two'));
  });

  it('最終行で改行してブロックを作ると、直後（後ろ）にできる', async () => {
    const last = await setupTwoTodos();
    last.focus();
    last.setSelectionRange(last.value.length, last.value.length);

    // 1回目: 行内改行。2回目: 行が空になったので次のブロックを作る。
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getAllByRole('textbox').length).toBe(3);
    });

    const values = screen.getAllByRole('textbox').map(el => (el as HTMLTextAreaElement).value);
    const idxTwo = values.indexOf('todo two');
    expect(idxTwo).toBeGreaterThanOrEqual(0);
    // 新しいブロック(空文字)は "todo two" の直後に来るべき。
    expect(values[idxTwo + 1]).toBe('');
  });

  it('矢印キーで行き来してから改行・入力しても、ブロックが余分に増えたりズレたりしない', async () => {
    const last = await setupTwoTodos();
    const before = screen.getAllByRole('textbox').length;

    // 上のブロックを見に行ってから戻る（ここでブロックが増えてはいけない）。
    last.focus();
    await userEvent.keyboard('{ArrowUp}');
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getAllByRole('textbox').length).toBe(before);

    // 戻ってきて末尾に改行を作り、次のブロックを作成する。
    const current = screen.getByDisplayValue('todo two') as HTMLTextAreaElement;
    current.focus();
    current.setSelectionRange(current.value.length, current.value.length);
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getAllByRole('textbox').length).toBe(before + 1);
    });
    const values = screen.getAllByRole('textbox').map(el => (el as HTMLTextAreaElement).value);
    expect(values.indexOf('') ).toBe(values.indexOf('todo two') + 1);
  });
});
