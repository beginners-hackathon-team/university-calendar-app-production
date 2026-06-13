import { supabase } from '../lib/supabase'

export async function login(email: string, password: string): Promise<void> {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
}

export async function register(email: string, password: string): Promise<void> {
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) throw new Error(error.message)
}

export async function loginWithGoogle(): Promise<void> {
    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/` },
    })
    if (error) throw new Error(error.message)
}

export async function logout(): Promise<void> {
    await supabase.auth.signOut()
}

export async function getToken(): Promise<string | null> {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
}

export async function isAuthenticated(): Promise<boolean> {
    const { data } = await supabase.auth.getSession()
    return !!data.session
}
