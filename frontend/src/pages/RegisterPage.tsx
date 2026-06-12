import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { register } from "../api/auth";

export default function RegisterPage() {
    const [displayName, setDisplayName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError('');

        try {
            await register(email, password, displayName);
            navigate('/');
        } catch (err) {
            setError((err as Error).message);
        }
    };

    return (
        <div style={{ maxWidth: 360, margin: '80px auto', padding: 24 }}>
            <h1>ユーザー登録</h1>
            <form onSubmit={handleSubmit}>
                <input
                    placeholder="表示名"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                />
                <input
                    type="email"
                    placeholder="メールアドレス"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />
                <input
                    type="password"
                    placeholder="パスワード"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />
                <button type="submit">登録</button>
                {error && <p style={{ color: 'red' }}>{error}</p>}
            </form>
        </div>
    );
}
