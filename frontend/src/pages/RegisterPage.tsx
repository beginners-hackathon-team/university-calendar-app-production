import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { register } from "../api/auth";

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

export default function RegisterPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(email, password);
      navigate('/');
    } catch (err) {
      setError((err as Error).message);
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
            新規登録
          </h1>
          <p className="text-[13.5px] mt-1.5" style={{ color: 'var(--c-text-3)' }}>
            アカンサスカレンダーへようこそ
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
              className="w-full font-semibold text-[14px] text-white"
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
              {loading ? '登録中...' : 'アカウントを作成'}
            </button>
          </form>

          <p className="text-center text-[13px] mt-7" style={{ color: 'var(--c-text-3)' }}>
            すでにアカウントをお持ちの方は{' '}
            <Link
              to="/login"
              className="font-semibold hover:underline"
              style={{ color: 'var(--c-accent)' }}
            >
              ログイン
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
