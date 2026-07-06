import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TasksPage from './TasksPage';
import type { Todo } from '../api/tasks';

// createTodo/deleteTodo の応答をテスト側で任意のタイミングまで遅らせ、
// 「ネットワーク応答を待たずにブロックが即座に反映される」ことを検証する。
vi.mock('../api/tasks', () => ({
  fetchAssignments: vi.fn().mockResolvedValue([]),
  fetchLmsSystemTypes: vi.fn().mockResolvedValue({}),
  fetchTodos: vi.fn().mockResolvedValue([]),
  createTodo: vi.fn(),
  updateTodo: vi.fn(),
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe('TasksPage TODOテキストモード: 作成/削除の楽観的更新', () => {
  beforeEach(() => {
    installMatchMediaMock();
    localStorage.setItem('ku-todo-view-mode', 'text');
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('Enterで空行から次のブロックを作るとき、サーバー応答を待たずに即座にブロックが増える', async () => {
    const { createTodo } = await import('../api/tasks');
    const first = deferred<Todo>();
    vi.mocked(createTodo).mockReturnValueOnce(first.promise as Promise<Todo>);

    render(<TasksPage />);

    // 「1件も無ければ空ブロックを1つ確保する」エフェクトが最初の作成を呼ぶ。
    await waitFor(() => expect(createTodo).toHaveBeenCalledTimes(1));
    await act(async () => { first.resolve({ id: 'todo-1', title: '', is_done: false, done_at: null, created_at: 'now' }); });

    const textboxes = await screen.findAllByRole('textbox');
    const firstBox = textboxes[textboxes.length - 1] as HTMLTextAreaElement;

    const second = deferred<Todo>();
    vi.mocked(createTodo).mockReturnValueOnce(second.promise as Promise<Todo>);

    // 1回目のEnter: 行に文字があるのでブロック内で改行するだけ。
    // 2回目のEnter: 行が空になったので次のブロックを作る。
    await userEvent.type(firstBox, '牛乳を買う');
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard('{Enter}');

    // createTodo の Promise がまだ解決していない時点で、2つ目のテキストエリアが
    // 既にDOMに存在すること（＝ネットワーク往復を待たずに楽観的追加されていること）を確認する。
    await waitFor(() => {
      const boxes = screen.getAllByRole('textbox');
      expect(boxes.length).toBeGreaterThanOrEqual(2);
    });

    await act(async () => { second.resolve({ id: 'todo-2', title: '', is_done: false, done_at: null, created_at: 'now' }); });
  });

  it('削除ボタンはサーバー応答を待たずに即座にブロックを消す', async () => {
    const { fetchTodos, deleteTodo } = await import('../api/tasks');
    vi.mocked(fetchTodos).mockResolvedValueOnce([
      { id: 'todo-1', title: '買い物', is_done: false, done_at: null, created_at: 'now' },
      { id: 'todo-2', title: '掃除', is_done: false, done_at: null, created_at: 'now' },
    ]);

    const del = deferred<void>();
    vi.mocked(deleteTodo).mockReturnValueOnce(del.promise);

    render(<TasksPage />);

    await screen.findByDisplayValue('買い物');
    const [deleteButton] = await screen.findAllByRole('button', { name: '削除' });
    await userEvent.click(deleteButton!);

    // deleteTodo がまだ解決していなくても、対象のテキストがDOMから消えていること。
    await waitFor(() => {
      expect(screen.queryByDisplayValue('買い物')).toBeNull();
    });

    await act(async () => { del.resolve(); });
  });
});
