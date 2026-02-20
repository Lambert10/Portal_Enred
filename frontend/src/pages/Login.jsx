import React, { useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";

export default function Login() {
  const nav = useNavigate();
  const loc = useLocation();

  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");

  function onSubmit(e) {
    e.preventDefault();
    setErr("");

    if (!email.trim() || !pass.trim()) {
      setErr("Ingresa correo y contraseña.");
      return;
    }

    // ✅ sesión MVP local
    try {
      localStorage.setItem("enred_session", JSON.stringify({ email, ts: Date.now() }));
    } catch {
      // ignore
    }

    const to = loc.state?.from || "/dashboards";
    nav(to, { replace: true });
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <div style={styles.head}>
          <div style={styles.logo} />
          <div>
            <h2 style={{ margin: 0 }}>Ingresar</h2>
            <p style={styles.sub}>Accede al portal de dashboards</p>
          </div>
        </div>

        {err && <div style={styles.err}>{err}</div>}

        <form onSubmit={onSubmit} style={{ marginTop: 12 }}>
          <label style={styles.label}>Correo</label>
          <input
            style={styles.input}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@empresa.com"
          />

          <label style={styles.label}>Contraseña</label>
          <input
            style={styles.input}
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            placeholder="••••••••"
          />

          <button style={styles.btn} type="submit">
            Entrar →
          </button>

          <div style={styles.links}>
            <Link to="/" style={styles.link}>← Volver al inicio</Link>
          </div>

          <div style={styles.note}>
            * MVP: esto no valida contra servidor todavía. Luego lo hacemos con JWT.
          </div>
        </form>
      </div>
    </div>
  );
}

const styles = {
  wrap: { minHeight: "100vh", display: "grid", placeItems: "center", padding: 20 },
  card: {
    width: "min(420px, 100%)",
    padding: 18,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,.08)",
    background: "linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.03))",
    boxShadow: "0 18px 70px rgba(0,0,0,.40)",
  },
  head: { display: "flex", alignItems: "center", gap: 12 },
  logo: {
    width: 44, height: 44, borderRadius: 14,
    background:
      "radial-gradient(circle at 30% 30%, rgba(34,211,238,.95), transparent 55%), radial-gradient(circle at 70% 70%, rgba(124,92,255,.95), transparent 55%), linear-gradient(135deg, rgba(255,255,255,.10), rgba(255,255,255,.02))",
    border: "1px solid rgba(255,255,255,.12)",
  },
  sub: { margin: "4px 0 0", fontSize: 12, color: "rgba(232,236,255,.65)" },
  label: { display: "block", marginTop: 12, marginBottom: 6, fontSize: 12, color: "rgba(232,236,255,.70)" },
  input: {
    width: "100%",
    padding: "11px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,.10)",
    background: "rgba(0,0,0,.22)",
    color: "rgba(232,236,255,.92)",
    outline: "none",
  },
  btn: {
    width: "100%",
    marginTop: 14,
    padding: "11px 14px",
    borderRadius: 14,
    border: "1px solid rgba(124,92,255,.35)",
    background: "linear-gradient(135deg, rgba(124,92,255,.38), rgba(34,211,238,.18))",
    color: "rgba(232,236,255,.95)",
    fontWeight: 800,
    cursor: "pointer",
  },
  err: {
    marginTop: 12,
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(239,68,68,.35)",
    background: "rgba(239,68,68,.12)",
    color: "rgba(255,230,230,.95)",
    fontSize: 13,
  },
  links: { marginTop: 10, display: "flex", justifyContent: "center" },
  link: { fontSize: 12, color: "rgba(232,236,255,.75)", textDecoration: "none" },
  note: { marginTop: 10, fontSize: 12, color: "rgba(232,236,255,.50)" },
};