import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { getHomePath } from "../App";

export default function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.exchangeCodeForSession(window.location.href).then(({ error }) => {
      if (error) {
        console.error("OAuth callback error:", error.message);
        navigate("/login", { replace: true });
      } else {
        navigate(getHomePath(), { replace: true });
      }
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
