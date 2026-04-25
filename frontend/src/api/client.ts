import { getToken, logout } from "./auth";

// 認証付きfetchラッパー
export async function authFetch(input: RequestInfo, init: RequestInit = {}): Promise<Response> {
    const token = getToken();
    const headers = new Headers(init.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);

    const res = await fetch(input, {...init, headers});

    // 認証エラーでログアウト画面へ
    if (res.status === 401) {
        logout();
        window.location.href = '/login';
    }
    return res;
}