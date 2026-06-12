import { authFetch } from './client';

export type Assignment = {
  id: string;
  task_name: string;
  task_contents_id: string;
  course_name: string | null;
  submitted_at: string | null;
  result: string;
  score: string | null;
  is_done: boolean;
  created_at: string;
};

export type Todo = {
  id: string;
  title: string;
  is_done: boolean;
  created_at: string;
};

export async function fetchAssignments(): Promise<Assignment[]> {
  const res = await authFetch('/api/assignments');
  if (!res.ok) throw new Error('課題の取得に失敗しました');
  return res.json();
}

export async function markAssignmentDone(id: string): Promise<void> {
  const res = await authFetch(`/api/assignments/${id}/done`, { method: 'PUT' });
  if (!res.ok) throw new Error('課題の更新に失敗しました');
}

export async function deleteAssignment(id: string): Promise<void> {
  const res = await authFetch(`/api/assignments/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('課題の削除に失敗しました');
}

export async function fetchTodos(): Promise<Todo[]> {
  const res = await authFetch('/api/todos');
  if (!res.ok) throw new Error('TODOの取得に失敗しました');
  return res.json();
}

export async function createTodo(title: string): Promise<Todo> {
  const res = await authFetch('/api/todos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error('TODOの作成に失敗しました');
  return res.json();
}

export async function updateTodo(id: string, data: { title?: string; is_done?: boolean }): Promise<Todo> {
  const res = await authFetch(`/api/todos/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('TODOの更新に失敗しました');
  return res.json();
}

export async function deleteTodo(id: string): Promise<void> {
  const res = await authFetch(`/api/todos/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('TODOの削除に失敗しました');
}
