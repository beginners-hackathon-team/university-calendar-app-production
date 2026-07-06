import { createContext, useContext } from "react";

export type Me = {
    id: string;
    display_name: string | null;
    is_admin: boolean;
    assignment_sync_mode: 'auto' | 'manual';
};

export type MeContextValue = {
    me: Me | null;
    loading: boolean;
    isAdmin: boolean;
};

export const MeContext = createContext<MeContextValue | null>(null);

export function useMe(): MeContextValue {
    const ctx = useContext(MeContext);
    if (!ctx) {
        throw new Error("useMe must be used within a MeProvider");
    }
    return ctx;
}
