import React, { useState, type FormEvent} from "react";
import { Link, useNavigate } from "react-router-dom";
import { login } from "../api/auth";

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError('');
        
        try {
            await login(username, password);
            navigate('/');
        } catch {
            setError('ユーザー名またはパスワードが違います');
        }
    };

    return (
        <div style={{ maxWidth: 360, margin: '80px auto', padding: 24 }}>
        <h1>ログイン</h1>
        <form onSubmit={handleSubmit}>
            <input
            placeholder="ユーザー名"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            />
            <input
            type="password"
            placeholder="パスワード"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            />
            <button type="submit">ログイン</button>
            {error && <p style={{ color: 'red' }}>{error}</p>}
        </form>
        <p>アカウントをお持ちでない方は <Link to="/register">新規登録</Link></p>
        </div>
    );
}