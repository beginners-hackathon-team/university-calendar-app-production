import { Routes, Route, Navigate } from "react-router-dom";
import CalendarPage from "./pages/CalendarPage";
import CoursesPage from "./pages/CoursesPage";
import LoginPage from "./pages/LoginPage";
import Layout from "./Layout";
import React, { useEffect, useState } from "react";
import AdminEventsPage from "./pages/AdminEventsPage";
import { useMe } from "./hooks/useMe";
import RegisterPage from "./pages/RegisterPage";
import { supabase } from "./lib/supabase";
import type { Session } from "@supabase/supabase-js";

function AdminRoute({ children }: { children: React.ReactNode }) {
    const { isAdmin, loading } = useMe();
    if (loading) return <p>Loading...</p>;
    return isAdmin ? <>{children}</> : <Navigate to="/" replace />;
}

function PrivateRoute({ children, session, loading }: { children: React.ReactNode; session: Session | null; loading: boolean }) {
    if (loading) return <p>Loading...</p>;
    return session ? <>{children}</> : <Navigate to="/login" replace />;
}

function GuestRoute({ children, session, loading }: { children: React.ReactNode; session: Session | null; loading: boolean }) {
    if (loading) return <p>Loading...</p>;
    return session ? <Navigate to="/" replace /> : <>{children}</>;
}

export default function App() {
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            setSession(data.session);
            setLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            setSession(session);

            // OAuth初回ログイン時、プロフィールがなければ自動作成
            if (event === 'SIGNED_IN' && session) {
                const check = await fetch('/api/me', {
                    headers: { Authorization: `Bearer ${session.access_token}` },
                });
                if (check.status === 401) {
                    const displayName =
                        (session.user.user_metadata?.full_name as string | undefined)
                        ?? session.user.email?.split('@')[0]
                        ?? 'ユーザー';
                    await fetch('/api/profiles', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${session.access_token}`,
                        },
                        body: JSON.stringify({ display_name: displayName }),
                    });
                }
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    return (
        <Routes>
            <Route path="/login" element={<GuestRoute session={session} loading={loading}><LoginPage /></GuestRoute>} />
            <Route path="/register" element={<GuestRoute session={session} loading={loading}><RegisterPage /></GuestRoute>} />

            <Route element={<PrivateRoute session={session} loading={loading}><Layout /></PrivateRoute>}>
                <Route path="/" element={<CalendarPage />} />
                <Route path="/courses" element={<CoursesPage />} />
                <Route path="/admin/events" element={<AdminRoute><AdminEventsPage /></AdminRoute>} />
            </Route>

            <Route path="*" element={<h2>Not Found Page</h2>} />
        </Routes>
    );
}
