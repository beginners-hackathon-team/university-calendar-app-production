export type UniversityEvent = {
    id: string;
    name: string;
    type: 'exam' | 'transfer' | 'interval' | 'other';
    date: string;
    original_day: string;
};

export async function fetchUniversityEvents(year: number): Promise<UniversityEvent[]> {
    const res = await fetch(`/api/university-events/${year}`);
    if (!res.ok) throw new Error('大学イベントの取得に失敗しました');
    return res.json()
}