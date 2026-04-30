import { Routes, Route, Navigate } from "react-router-dom";
import CalendarPage from "./pages/CalendarPage";
import CoursesPage from "./pages/CoursesPage";
import LoginPage from "./pages/LoginPage";
import Layout from "./Layout";
import { isAuthenticated } from "./api/auth";
import React from "react";
import AdminEventsPage from "./pages/AdminEventsPage";
import { useMe } from "./hooks/useMe";


function AdminRoute({ children }: { children: React.ReactNode}) {
    const { isAdmin, loading } = useMe();

    if (loading) return <p>Loading...</p>;
    return isAdmin ? <>{children}</> : <Navigate to="/" replace />;
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
    return isAuthenticated() ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
    
    return (
        <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
                <Route path="/" element={<CalendarPage />} />
                <Route path="/courses" element={<CoursesPage />} />
                <Route path="/admin/events" element={<AdminRoute><AdminEventsPage /></AdminRoute>} />
            </Route>

            <Route path="*" element={<h2>Not Found Page</h2>} />
        </Routes>
    );

}