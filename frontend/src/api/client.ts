import { supabase } from '../lib/supabase'

export async function authFetch(input: RequestInfo, init: RequestInit = {}): Promise<Response> {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token ?? null

    const headers = new Headers(init.headers)
    if (token) headers.set('Authorization', `Bearer ${token}`)

    const res = await fetch(input, { ...init, headers })

    if (res.status === 401) {
        await supabase.auth.signOut()
        window.location.href = '/login'
    }
    return res
}
