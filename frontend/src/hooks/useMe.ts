import { useEffect, useState } from "react";
import { authFetch } from "../api/client";

export type Me = {
    id: string;
    display_name: string | null;
    is_admin: boolean;
    assignment_sync_mode: 'auto' | 'manual';
};

export function useMe() {
    const [me, setMe] = useState<Me | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        authFetch('/api/me').then((res) => (res.ok ? res.json() : null))
            .then((data) => setMe(data))
            .finally(() => setLoading(false));
    }, []);

    return { me, loading, isAdmin: me?.is_admin ?? false };
}
