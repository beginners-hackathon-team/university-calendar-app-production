import { useState, useRef, useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useMe } from "./hooks/useMe";
import { logout } from "./api/auth";
import { updateDisplayName } from "./api/me";
import { useNavigate } from "react-router-dom";
import { HOME_PATH_KEY, DEFAULT_HOME } from "./App";

const ACCENT = "#4B82F5";
const ACCENT_HOVER = "#3A70E2";

/* ── Icons ─────────────────────────────────────────────────── */

function LogoMark() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <rect x="1" y="2.5" width="13" height="11" rx="2.2" stroke="white" strokeWidth="1.4" />
      <path d="M1 6.5h13" stroke="white" strokeWidth="1.4" />
      <path d="M4.5 1v3M10.5 1v3" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="5" cy="10" r="1" fill="white" />
      <circle cx="7.5" cy="10" r="1" fill="white" />
      <circle cx="10" cy="10" r="1" fill="white" />
    </svg>
  );
}


function UserCircle({ initial }: { initial: string }) {
  return (
    <span className="w-full h-full flex items-center justify-center text-[13px] font-semibold text-white select-none">
      {initial}
    </span>
  );
}

function HamburgerIcon({ open }: { open: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d={open ? "M4 4l12 12M16 4L4 16" : "M3 5.5h14M3 10h14M3 14.5h14"}
        stroke="#555"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckSmall() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Layout ─────────────────────────────────────────────────── */

export default function Layout() {
  const location = useLocation();
  const { me, isAdmin } = useMe();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [homePath, setHomePath] = useState(
    () => localStorage.getItem(HOME_PATH_KEY) ?? DEFAULT_HOME
  );
  const userMenuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
        setEditing(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  const handleEditStart = () => {
    setNameInput(me?.display_name ?? "");
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
    { path: "/calendar", label: "カレンダー" },
    { path: "/courses", label: "時間割" },
    { path: "/tasks", label: "タスク" },
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

  const isActive = (path: string) => location.pathname === path;
  const displayName = me?.display_name;
  const initial = displayName ? displayName.slice(0, 1) : "?";

  return (
    <>
      {/* ── Header ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white" style={{ borderBottom: '1px solid var(--c-border)', boxShadow: '0 1px 0 rgba(0,0,0,0.03)' }}>
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 h-[60px] flex items-center gap-4">

          {/* Brand */}
          <Link
            to="/"
            className="flex items-center gap-[9px] flex-shrink-0 group mr-2"
            aria-label="ホームへ"
          >
            <div
              className="w-[30px] h-[30px] rounded-[8px] flex items-center justify-center flex-shrink-0"
              style={{ background: ACCENT }}
            >
              <LogoMark />
            </div>
            <span className="text-[15px] font-semibold text-[#111111] tracking-[-0.015em] hidden sm:block">
              アカンサスカレンダー
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-0.5">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={[
                  "px-[14px] py-[7px] rounded-[8px] text-[14px] font-medium transition-all duration-100",
                  isActive(item.to)
                    ? "text-[#111111] bg-[#F4F4F4]"
                    : "text-[#888888] hover:text-[#333333] hover:bg-[#F6F6F6]",
                ].join(" ")}
              >
                {item.label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                to="/admin/events"
                className={[
                  "px-[14px] py-[7px] rounded-[8px] text-[14px] font-medium transition-all duration-100",
                  isActive("/admin/events")
                    ? "text-[#111111] bg-[#F4F4F4]"
                    : "text-[#888888] hover:text-[#333333] hover:bg-[#F6F6F6]",
                ].join(" ")}
              >
                管理
              </Link>
            )}
          </nav>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Right — Portal + User + Mobile toggle */}
          <div className="flex items-center gap-2.5">

            {/* User Menu */}
            <div ref={userMenuRef} className="relative">
              <button
                onClick={() => setUserMenuOpen((v) => !v)}
                className={[
                  "w-[36px] h-[36px] rounded-full overflow-hidden flex-shrink-0 transition-all duration-100",
                  userMenuOpen ? "ring-2 ring-offset-2 ring-[#4B82F5]" : "",
                ].join(" ")}
                style={{ background: ACCENT }}
                aria-label="ユーザーメニュー"
                aria-expanded={userMenuOpen}
              >
                <UserCircle initial={initial} />
              </button>

              {/* Dropdown */}
              {userMenuOpen && (
                <div
                  className="absolute right-0 top-[calc(100%+10px)] w-[248px] bg-white rounded-[14px] border border-[#EBEBEB] z-50 overflow-hidden"
                  style={{
                    boxShadow: "0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06), 0 0 0 0.5px rgba(0,0,0,0.04)",
                  }}
                >
                  {/* User name */}
                  <div className="px-4 py-4 border-b border-[#F5F5F5]">
                    {editing ? (
                      <div>
                        <input
                          autoFocus
                          value={nameInput}
                          onChange={(e) => setNameInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSave();
                            if (e.key === "Escape") setEditing(false);
                          }}
                          placeholder="ユーザー名"
                          className="w-full px-3 py-2 text-[13px] border border-[#E0E0E0] rounded-[8px] outline-none transition-all"
                          style={{}}
                          onFocus={(e) => {
                            e.currentTarget.style.borderColor = ACCENT;
                            e.currentTarget.style.boxShadow = `0 0 0 3px rgba(75,130,245,0.15)`;
                          }}
                          onBlur={(e) => {
                            e.currentTarget.style.borderColor = "#E0E0E0";
                            e.currentTarget.style.boxShadow = "none";
                          }}
                        />
                        <div className="flex gap-2 mt-2.5">
                          <button
                            onClick={handleSave}
                            className="flex-1 py-[7px] text-[13px] font-semibold text-white rounded-[8px] transition-colors"
                            style={{ background: ACCENT }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = ACCENT_HOVER; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = ACCENT; }}
                          >
                            保存
                          </button>
                          <button
                            onClick={() => setEditing(false)}
                            className="flex-1 py-[7px] text-[13px] font-medium bg-[#F4F4F4] text-[#555] rounded-[8px] hover:bg-[#EAEAEA] transition-colors"
                          >
                            キャンセル
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[14px] font-semibold text-[#1A1A1A] truncate">
                          {displayName ?? (
                            <span className="text-[#AAAAAA] font-normal">ユーザー名未設定</span>
                          )}
                        </p>
                        <button
                          onClick={handleEditStart}
                          className="text-[11px] text-[#888] bg-[#F4F4F4] hover:bg-[#EAEAEA] px-[10px] py-[4px] rounded-[6px] transition-colors flex-shrink-0 font-medium"
                        >
                          編集
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Home setting */}
                  <div className="px-4 py-3 border-b border-[#F5F5F5]">
                    <p className="text-[10px] font-semibold text-[#BBBBBB] uppercase tracking-[0.07em] mb-2">
                      ホーム画面
                    </p>
                    <div className="flex gap-1.5">
                      {HOME_OPTIONS.map((opt) => (
                        <button
                          key={opt.path}
                          onClick={() => handleSetHome(opt.path)}
                          className={[
                            "flex-1 flex items-center justify-center gap-1 py-[6px] text-[12px] font-medium rounded-[7px] transition-all duration-100",
                            homePath === opt.path
                              ? "bg-[#EEF3FE] text-[#4B82F5]"
                              : "bg-[#F6F6F6] text-[#777] hover:bg-[#EEEEEE]",
                          ].join(" ")}
                        >
                          {homePath === opt.path && <CheckSmall />}
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Logout */}
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-3.5 text-[14px] text-[#F04646] hover:bg-[#FFF5F5] transition-colors font-medium"
                  >
                    ログアウト
                  </button>
                </div>
              )}
            </div>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileNavOpen((v) => !v)}
              className="md:hidden w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#F4F4F4] transition-colors"
              aria-label={mobileNavOpen ? "メニューを閉じる" : "メニューを開く"}
            >
              <HamburgerIcon open={mobileNavOpen} />
            </button>
          </div>
        </div>

        {/* Mobile Nav Drawer */}
        {mobileNavOpen && (
          <div className="md:hidden border-t border-[#F0F0F0] bg-white">
            <nav className="px-4 py-3 flex flex-col gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileNavOpen(false)}
                  className={[
                    "px-4 py-3 rounded-[10px] text-[15px] font-medium transition-colors",
                    isActive(item.to)
                      ? "text-[#111111] bg-[#F4F4F4]"
                      : "text-[#666666] hover:bg-[#F6F6F6]",
                  ].join(" ")}
                >
                  {item.label}
                </Link>
              ))}
              {isAdmin && (
                <Link
                  to="/admin/events"
                  onClick={() => setMobileNavOpen(false)}
                  className={[
                    "px-4 py-3 rounded-[10px] text-[15px] font-medium transition-colors",
                    isActive("/admin/events")
                      ? "text-[#111111] bg-[#F4F4F4]"
                      : "text-[#666666] hover:bg-[#F6F6F6]",
                  ].join(" ")}
                >
                  大学イベント管理
                </Link>
              )}
            </nav>
          </div>
        )}
      </header>

      {/* ── Page Content ───────────────────────────────────── */}
      <main>
        <Outlet />
      </main>
    </>
  );
}
