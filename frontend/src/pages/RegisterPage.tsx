import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { login, register } from "../api/auth";

export default function RegisterPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError('');

        try {
            await register(username, password, email);
            await login(username, password);
            navigate('/');
        } catch (err) {
            setError((err as Error).message)
        }
    };

    return (
        <div style={{ maxWidth: 360, margin: '80px auto', padding: 24 }}>
        <h1>ユーザー登録</h1>
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
            <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            />
            <button type="submit">登録</button>
            {error && <p style={{ color: 'red' }}>{error}</p>}
        </form>
        </div>
    );
}