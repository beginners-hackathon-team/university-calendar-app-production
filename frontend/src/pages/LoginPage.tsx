import React, { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login, loginWithGoogle } from "../api/auth";

function CalendarMark() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2.5" y="4" width="19" height="17" rx="3.5" stroke="white" strokeWidth="1.9" />
      <path d="M2.5 10h19" stroke="white" strokeWidth="1.9" />
      <path d="M8 2.5v3M16 2.5v3" stroke="white" strokeWidth="1.9" strokeLinecap="round" />
      <circle cx="8.5" cy="15" r="1.3" fill="white" />
      <circle cx="12" cy="15" r="1.3" fill="white" />
      <circle cx="15.5" cy="15" r="1.3" fill="white" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9086c1.7018-1.5668 2.6836-3.874 2.6836-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.4673-.8059 5.9564-2.1805l-2.9086-2.2581c-.8059.54-1.8368.859-3.0478.859-2.344 0-4.3282-1.584-5.036-3.7105H.9573v2.3318C2.4382 15.9832 5.4818 18 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71c-.18-.54-.2836-1.1168-.2836-1.71s.1036-1.17.2836-1.71V4.9582H.9573C.3477 6.1732 0 7.5482 0 9s.3477 2.8268.9573 4.0418L3.964 10.71z" fill="#FBBC05"/>
      <path d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5814C13.4627.8918 11.4255 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.964 7.29C4.6718 5.1636 6.656 3.5795 9 3.5795z" fill="#EA4335"/>
    </svg>
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch {
      setError('メールアドレスまたはパスワードが違います');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-14" style={{ background: 'var(--c-bg)' }}>
      <div className="w-full" style={{ maxWidth: 400 }}>

        {/* Brand mark */}
        <div className="flex flex-col items-center mb-10">
          <div
            className="flex items-center justify-center mb-5"
            style={{
              width: 56, height: 56,
              borderRadius: 18,
              background: 'var(--c-accent)',
              boxShadow: '0 6px 20px rgba(75,130,245,0.32)',
            }}
          >
            <CalendarMark />
          </div>
          <h1
            className="font-bold text-[22px]"
            style={{ color: 'var(--c-text-1)', letterSpacing: '-0.025em' }}
          >
            アカンサスカレンダー
          </h1>
          <p className="text-[13.5px] mt-1.5" style={{ color: 'var(--c-text-3)' }}>
            金沢大学生のための学年暦カレンダー
          </p>
        </div>

        {/* Card */}
        <div
          className="bg-white"
          style={{
            borderRadius: 20,
            border: '1px solid var(--c-border)',
            boxShadow: '0 2px 12px rgba(0,0,0,0.055)',
            padding: '36px 32px 32px',
          }}
        >
          {/* Google login — primary CTA */}
          <button
            type="button"
            onClick={() => loginWithGoogle()}
            className="w-full flex items-center justify-center gap-3 font-medium text-[14px] transition-colors"
            style={{
              padding: '11px 16px',
              borderRadius: 12,
              border: '1.5px solid var(--c-border)',
              color: 'var(--c-text-1)',
              background: '#fff',
              cursor: 'pointer',
              letterSpacing: '-0.01em',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--c-bg)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#fff'; }}
          >
            <GoogleIcon />
            Googleでログイン
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1" style={{ height: 1, background: 'var(--c-border)' }} />
            <span className="text-[12px] font-medium" style={{ color: 'var(--c-text-3)' }}>または</span>
            <div className="flex-1" style={{ height: 1, background: 'var(--c-border)' }} />
          </div>

          {/* Email / password form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              type="email"
              placeholder="メールアドレス"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="ku-input w-full text-[14px]"
              style={{
                padding: '11px 14px',
                borderRadius: 'var(--r-input)',
                border: '1.5px solid var(--c-border)',
                color: 'var(--c-text-1)',
                background: '#fff',
              }}
            />
            <input
              type="password"
              placeholder="パスワード"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="ku-input w-full text-[14px]"
              style={{
                padding: '11px 14px',
                borderRadius: 'var(--r-input)',
                border: '1.5px solid var(--c-border)',
                color: 'var(--c-text-1)',
                background: '#fff',
              }}
            />

            {error && (
              <p
                className="text-[13px] rounded-[10px] px-4 py-2.5"
                style={{
                  color: 'var(--c-danger)',
                  background: '#FFF5F5',
                  border: '1px solid #FED7D7',
                }}
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full font-semibold text-[14px] text-white transition-colors"
              style={{
                marginTop: 6,
                padding: '11px 0',
                borderRadius: 12,
                background: loading ? '#7AAAFB' : 'var(--c-accent)',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 1px 5px rgba(75,130,245,0.28)',
                letterSpacing: '-0.01em',
              }}
              onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLElement).style.background = 'var(--c-accent-h)'; }}
              onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLElement).style.background = 'var(--c-accent)'; }}
            >
              {loading ? 'ログイン中...' : 'ログイン'}
            </button>
          </form>

          {/* Register link */}
          <p className="text-center text-[13px] mt-7" style={{ color: 'var(--c-text-3)' }}>
            アカウントをお持ちでない方は{' '}
            <Link
              to="/register"
              className="font-semibold hover:underline"
              style={{ color: 'var(--c-accent)' }}
            >
              新規登録
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
