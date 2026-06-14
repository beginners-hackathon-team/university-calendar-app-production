import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { getHomePath } from "../App";

export default function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    // Supabase automatically exchanges the PKCE code on initialization (detectSessionInUrl: true).
    // getSession() awaits initializePromise, so it resolves after the exchange completes.
    supabase.auth.getSession().then(({ data: { session } }) => {
      navigate(session ? getHomePath() : "/login", { replace: true });
    });
  }, [navigate]);

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--c-bg)",
    }}>
      <div className="ku-spinner" />
    </div>
  );
}
