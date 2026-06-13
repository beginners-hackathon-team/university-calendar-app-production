import { useState, useRef, useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useMe } from "./hooks/useMe";
import { logout } from "./api/auth";
import { updateDisplayName } from "./api/me";
import { useNavigate } from "react-router-dom";
import { HOME_PATH_KEY, DEFAULT_HOME } from "./App";


export default function Layout() {
    const location = useLocation();
    const { me, isAdmin } = useMe();
    const [menuOpen, setMenuOpen] = useState(false);
    const [editing, setEditing] = useState(false);
    const [nameInput, setNameInput] = useState('');
    const [homePath, setHomePath] = useState(() => localStorage.getItem(HOME_PATH_KEY) ?? DEFAULT_HOME);
    const menuRef = useRef<HTMLDivElement>(null);

    const navigate = useNavigate();
    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setMenuOpen(false);
                setEditing(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleEditStart = () => {
        setNameInput(me?.display_name ?? '');
        setEditing(true);
    };

    const handleSave = async () => {
        const trimmed = nameInput.trim();
        if (!trimmed) return;
        await updateDisplayName(trimmed);
        setEditing(false);
        window.location.reload();
    };

    const HOME_OPTIONS = [
        { path: '/calendar', label: 'カレンダー' },
        { path: '/courses', label: '時間割' },
        { path: '/tasks', label: 'タスク' },
    ];

    const handleSetHome = (path: string) => {
        localStorage.setItem(HOME_PATH_KEY, path);
        setHomePath(path);
    };

    const navItems = [
        { to: "/calendar", label: "カレンダー" },
        { to: "/courses", label: "時間割" },
        { to: "/tasks", label: "タスク" },
    ];

    const headerStyle: React.CSSProperties = {
        borderBottom: "1px solid #e5e7eb",
        background: "#fff",
    };

    const innerStyle: React.CSSProperties = {
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "14px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
    };

    const logoStyle: React.CSSProperties = {
        color: "#111827",
        fontSize: "18px",
        fontWeight: "bold",
        textDecoration: "none",
    };

    const getLinkStyle = (active: boolean): React.CSSProperties => ({
        padding: "6px 14px",
        marginLeft: "8px",
        color: active ? "#2563eb" : "#6b7280",
        textDecoration: "none",
        fontSize: "14px",
        fontWeight: active ? "bold" : "normal",
        borderBottom: active ? "2px solid #2563eb" : "2px solid transparent",
    });

    const iconButtonStyle: React.CSSProperties = {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "44px",
        height: "44px",
        borderRadius: "50%",
        border: "1px solid #e5e7eb",
        background: menuOpen ? "#f3f4f6" : "transparent",
        color: "#6b7280",
        cursor: "pointer",
        padding: 0,
    };

    const dropdownStyle: React.CSSProperties = {
        position: "absolute",
        top: "calc(100% + 8px)",
        right: 0,
        minWidth: "240px",
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: "10px",
        boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
        zIndex: 100,
        overflow: "hidden",
    };

    const menuNameStyle: React.CSSProperties = {
        padding: "16px 20px",
        fontSize: "15px",
        color: "#374151",
        fontWeight: "bold",
        borderBottom: "1px solid #f3f4f6",
        wordBreak: "break-all",
    };

    const menuLogoutStyle: React.CSSProperties = {
        display: "block",
        width: "100%",
        padding: "14px 20px",
        textAlign: "left",
        background: "transparent",
        border: "none",
        fontSize: "15px",
        color: "#ef4444",
        cursor: "pointer",
    };

    return (
        <>
            <header style={headerStyle}>
                <div style={innerStyle}>
                    <Link to="/" style={logoStyle}>
                        アカンサスカレンダー（金沢大学特化型カレンダー）
                    </Link>
                    <nav style={{ display: "flex", alignItems: "center" }}>
                        {navItems.map(item => (
                            <Link
                                key={item.to}
                                to={item.to}
                                style={getLinkStyle(location.pathname === item.to)}
                            >
                                {item.label}
                            </Link>
                        ))}
                        {isAdmin && <Link to="/admin/events" style={getLinkStyle(location.pathname === '/admin/events')}>大学イベント管理</Link>}

                        <div ref={menuRef} style={{ position: "relative", marginLeft: "16px" }}>
                            <button
                                onClick={() => setMenuOpen(v => !v)}
                                style={iconButtonStyle}
                                aria-label="ユーザーメニュー"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                                    <circle cx="12" cy="7" r="4"/>
                                </svg>
                            </button>

                            {menuOpen && (
                                <div style={dropdownStyle}>
                                    {editing ? (
                                        <div style={{ padding: '14px 16px', borderBottom: '1px solid #f3f4f6' }}>
                                            <input
                                                autoFocus
                                                value={nameInput}
                                                onChange={e => setNameInput(e.target.value)}
                                                onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
                                                placeholder="ユーザー名"
                                                style={{ width: '100%', padding: '6px 8px', fontSize: '14px', border: '1px solid #d1d5db', borderRadius: '6px', boxSizing: 'border-box' }}
                                            />
                                            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                                <button onClick={handleSave} style={{ flex: 1, padding: '6px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}>保存</button>
                                                <button onClick={() => setEditing(false)} style={{ flex: 1, padding: '6px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}>キャンセル</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ ...menuNameStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                            <span style={{ color: me?.display_name ? '#374151' : '#9ca3af' }}>
                                                {me?.display_name ?? 'ユーザー名未設定'}
                                            </span>
                                            <button onClick={handleEditStart} style={{ flexShrink: 0, padding: '2px 8px', fontSize: '12px', color: '#6b7280', background: '#f3f4f6', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>編集</button>
                                        </div>
                                    )}
                                    <div style={{ padding: '10px 16px', borderBottom: '1px solid #f3f4f6' }}>
                                        <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '6px', fontWeight: 'bold', letterSpacing: '0.05em' }}>ホームを変更</div>
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            {HOME_OPTIONS.map(opt => (
                                                <button
                                                    key={opt.path}
                                                    onClick={() => handleSetHome(opt.path)}
                                                    style={{
                                                        flex: 1,
                                                        padding: '5px 0',
                                                        fontSize: '12px',
                                                        border: '1px solid',
                                                        borderRadius: '5px',
                                                        cursor: 'pointer',
                                                        borderColor: homePath === opt.path ? '#2563eb' : '#e5e7eb',
                                                        background: homePath === opt.path ? '#eff6ff' : '#fff',
                                                        color: homePath === opt.path ? '#2563eb' : '#6b7280',
                                                        fontWeight: homePath === opt.path ? 'bold' : 'normal',
                                                    }}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <button onClick={handleLogout} style={menuLogoutStyle}>
                                        ログアウト
                                    </button>
                                </div>
                            )}
                        </div>
                    </nav>
                </div>
            </header>
            <main>
                <Outlet />
            </main>
        </>
    );
}
