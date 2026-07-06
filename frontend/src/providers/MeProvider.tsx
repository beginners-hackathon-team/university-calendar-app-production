import { useEffect, useState, type ReactNode } from "react";
import { authFetch } from "../api/client";
import { MeContext, type Me } from "../hooks/useMe";

export default function MeProvider({ children }: { children: ReactNode }) {
    const [me, setMe] = useState<Me | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        authFetch('/api/me').then((res) => (res.ok ? res.json() : null))
            .then((data) => setMe(data))
            .finally(() => setLoading(false));
    }, []);

    return (
        <MeContext.Provider value={{ me, loading, isAdmin: me?.is_admin ?? false }}>
            {children}
        </MeContext.Provider>
    );
}
