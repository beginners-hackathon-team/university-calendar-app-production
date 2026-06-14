import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { getHomePath } from "../App";

export default function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const error = params.get("error");
    const errorDescription = params.get("error_description");

    console.log("[AuthCallback] URL params:", { code: code ? "[present]" : null, error, errorDescription });

    if (error) {
      console.error("[AuthCallback] OAuth error from Supabase:", error, errorDescription);
      navigate("/login", { replace: true });
      return;
    }

    supabase.auth.getSession().then(({ data: { session }, error: sessionError }) => {
      console.log("[AuthCallback] getSession:", session?.user?.email ?? null, "error:", sessionError?.message ?? null);
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
