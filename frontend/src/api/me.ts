import { authFetch } from './client'

export async function updateDisplayName(displayName: string): Promise<void> {
    const res = await authFetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: displayName }),
    })
    if (!res.ok) throw new Error('ユーザー名の更新に失敗しました')
}
