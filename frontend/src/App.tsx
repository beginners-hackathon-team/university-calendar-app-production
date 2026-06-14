import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import CalendarPage from "./pages/CalendarPage";
import CoursesPage from "./pages/CoursesPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import AdminEventsPage from "./pages/AdminEventsPage";
import TasksPage from "./pages/TasksPage";
import Layout from "./Layout";
import { useMe } from "./hooks/useMe";
import { supabase } from "./lib/supabase";

function AppLoader() {
    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--c-bg)',
        }}>
            <div className="ku-spinner" />
        </div>
    );
}

export const HOME_PATH_KEY = 'ku-home-path'
export const DEFAULT_HOME = '/calendar'
export function getHomePath(): string {
    return localStorage.getItem(HOME_PATH_KEY) ?? DEFAULT_HOME
}

function AdminRoute({ children }: { children: React.ReactNode }) {
    const { isAdmin, loading } = useMe();
    if (loading) return <AppLoader />;
    return isAdmin ? <>{children}</> : <Navigate to={getHomePath()} replace />;
}

function PrivateRoute({ children, session, loading }: { children: React.ReactNode; session: Session | null; loading: boolean }) {
    if (loading) return <AppLoader />;
    return session ? <>{children}</> : <Navigate to="/login" replace />;
}

function GuestRoute({ children, session, loading }: { children: React.ReactNode; session: Session | null; loading: boolean }) {
    if (loading) return <AppLoader />;
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

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });

        return () => subscription.unsubscribe();
    }, []);

    return (
        <Routes>
            <Route path="/login" element={<GuestRoute session={session} loading={loading}><LoginPage /></GuestRoute>} />
            <Route path="/register" element={<GuestRoute session={session} loading={loading}><RegisterPage /></GuestRoute>} />

            <Route element={<PrivateRoute session={session} loading={loading}><Layout /></PrivateRoute>}>
                <Route path="/" element={<Navigate to={getHomePath()} replace />} />
                <Route path="/calendar" element={<CalendarPage />} />
                <Route path="/courses" element={<CoursesPage />} />
                <Route path="/tasks" element={<TasksPage />} />
                <Route path="/admin/events" element={<AdminRoute><AdminEventsPage /></AdminRoute>} />
            </Route>

            <Route path="*" element={<h2>Not Found Page</h2>} />
        </Routes>
    );
}
