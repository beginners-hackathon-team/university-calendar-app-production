import { authFetch } from "./client";

export type PersonalEvent = {
  id: string;
  title: string;
  start: string;
  end: string | null;
  all_day: boolean;
};

export async function fetchPersonalEvents(): Promise<PersonalEvent[]> {
  const res = await authFetch("/api/personal-events");
  if (!res.ok) throw new Error("個人予定の取得に失敗しました");
  return res.json();
}

export async function createPersonalEvent(event: {
  title: string;
  start: string;
  end: string | null;
  all_day: boolean;
}): Promise<PersonalEvent> {
  const res = await authFetch("/api/personal-events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
  });
  if (!res.ok) throw new Error("個人予定の追加に失敗しました");
  return res.json();
}

export async function deletePersonalEvent(id: string): Promise<void> {
  const res = await authFetch(`/api/personal-events/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("個人予定の削除に失敗しました");
}
