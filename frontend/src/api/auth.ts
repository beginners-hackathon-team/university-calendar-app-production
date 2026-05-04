// ログイン認証関連

const TOKEN_KEY = 'access_token';

export async function login(username: string, password: string): Promise<void> {
    const body = new URLSearchParams();
    body.append('username', username)
    body.append('password', password)

    const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
    });

    if (!res.ok) throw new Error('ログインに失敗しました');

    const data: { access_token: string; token_type: string} = await res.json()
    localStorage.setItem(TOKEN_KEY, data.access_token);
}

export async function register(name: string, password: string, email: string) {
    const res = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({ name, email, password }),
    });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail ?? '登録に失敗しました');
    }
}

export function logout(): void {
    localStorage.removeItem(TOKEN_KEY);
}

export function getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
}

export function isAuthenticated(): boolean {
    return !!getToken()
}