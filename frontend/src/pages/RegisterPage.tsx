import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { register } from "../api/auth";

export default function RegisterPage() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError('');

        try {
            await register(email, password);
            navigate('/');
        } catch (err) {
            setError((err as Error).message);
        }
    };

    return (
        <div style={{ maxWidth: 360, margin: '80px auto', padding: 24, fontFamily: 'sans-serif' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '24px', color: '#111827' }}>ユーザー登録</h1>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <input
                    type="email"
                    placeholder="メールアドレス"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    style={inputStyle}
                />
                <input
                    type="password"
                    placeholder="パスワード"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    style={inputStyle}
                />
                <button type="submit" style={primaryButtonStyle}>登録</button>
                {error && <p style={{ color: '#dc2626', fontSize: '14px', margin: 0 }}>{error}</p>}
            </form>
            <button
                onClick={() => navigate('/login')}
                style={secondaryButtonStyle}
            >
                ログイン画面へ
            </button>
        </div>
    );
}

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    boxSizing: 'border-box',
    outline: 'none',
};

const primaryButtonStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px',
    backgroundColor: '#1a56db',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 'bold',
    cursor: 'pointer',
    marginTop: '4px',
};

const secondaryButtonStyle: React.CSSProperties = {
    marginTop: '12px',
    width: '100%',
    padding: '10px',
    background: 'transparent',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    color: '#6b7280',
    fontSize: '14px',
    cursor: 'pointer',
    boxSizing: 'border-box',
};
