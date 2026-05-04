import { authFetch } from "./client";

export type UniversityEvent = {
    id: string;
    name: string;
    type: 'exam' | 'transfer' | 'interval' | 'other';
    date: string;
    original_day: string;
};

export async function fetchUniversityEvents(year: number): Promise<UniversityEvent[]> {
    const res = await authFetch(`/api/university-events/${year}`);
    if (!res.ok) throw new Error('大学イベントの取得に失敗しました');
    return res.json()
}

export async function createUniversityEvent(event: Omit<UniversityEvent, 'id'> & { year: number}) { // OmitでUniversityEventからidを除く->サーバーがidを生成するので必要ない
    const res = await authFetch(`/api/university-events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify(event)
    });
    if (!res.ok) throw new Error('追加に失敗しました');
    return res.json();
}

export async function updateUniversityEvent(id: string, event: Omit<UniversityEvent, 'id'> & { year: number}) {
    const res = await authFetch(`/api/university-events/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify(event),
    });
    if (!res.ok) throw new Error('更新に失敗しました');
    return res.json();
}

export async function deleteUniversityEvent(id: string) {
    const res = await authFetch(`/api/university-events/${id}`, {
        method: 'DELETE'
    });
    if(!res.ok) throw new Error('削除に失敗しました');
}