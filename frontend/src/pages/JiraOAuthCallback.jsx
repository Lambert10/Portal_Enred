import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiGet } from "../lib/api";

export default function JiraOAuthCallback() {
  const nav = useNavigate();
  const location = useLocation();
  const [msg, setMsg] = useState("Procesando autorizacion Jira...");
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    const params = new URLSearchParams(location.search || "");
    const code = params.get("code") || "";
    const state = params.get("state") || "";
    const oauthErr = params.get("error") || "";

    async function run() {
      if (oauthErr) {
        if (!alive) return;
        setErr(`OAuth Jira error: ${oauthErr}`);
        return;
      }

      if (!code || !state) {
        if (!alive) return;
        setErr("No se recibio code/state desde Jira.");
        return;
      }

      try {
        const data = await apiGet(
          `/api/integrations/jira/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`
        );
        if (!alive) return;
        const slug = data?.client_slug;
        setMsg("Conexion Jira completada. Redirigiendo...");
        nav(slug ? `/jira/${slug}` : "/jira", { replace: true });
      } catch (e) {
        if (!alive) return;
        setErr(e.message || "No se pudo completar callback Jira.");
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [location.search, nav]);

  if (err) return <div className="state error">Error: {err}</div>;
  return <div className="state">{msg}</div>;
}
