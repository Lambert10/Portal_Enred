import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

export default function AppLayout() {
  const nav = useNavigate();

  function logout() {
    try {
      localStorage.removeItem("enred_session");
    } catch {
      // ignore
    }
    nav("/login", { replace: true });
  }

  return (
    <div className="appShell">
      <div className="shellGrid">
        <aside className="sidebar">
          <div className="brandRow">
            <div className="brandLogo" />
            <div className="brandText">
              <h2>Portal Enred</h2>
              <p>BI para clientes</p>
            </div>
          </div>

          <nav className="nav">
            <NavLink
              to="/dashboards"
              className={({ isActive }) => `navLink ${isActive ? "navLinkActive" : ""}`}
            >
              <span>📊 Dashboards</span>
              <span className="navMeta">Lista</span>
            </NavLink>

            <NavLink
              to="/dashboard/abastible"
              className={({ isActive }) => `navLink ${isActive ? "navLinkActive" : ""}`}
            >
              <span>🧩 Último abierto</span>
              <span className="navMeta">View</span>
            </NavLink>

            <a className="navLink" href="#" onClick={(e) => e.preventDefault()}>
              <span>⚙️ Admin (pronto)</span>
              <span className="navMeta">Soon</span>
            </a>
          </nav>

          <div
            style={{
              marginTop: 16,
              padding: "10px 10px",
              color: "rgba(232,236,255,.55)",
              fontSize: 12,
            }}
          >
            Próximo paso: login real + panel admin + embedded tokens.
          </div>
        </aside>

        <main className="main">
          <div className="topbar">
            <div className="topTitle">
              <h1>Portal de Dashboards</h1>
              <span>Vista tecnológica / estilo SaaS</span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div className="search">
                <span style={{ opacity: 0.75 }}>⌕</span>
                <input placeholder="Buscar (próximamente global)..." disabled />
              </div>

              <button
                onClick={logout}
                style={{
                  cursor: "pointer",
                  padding: "10px 12px",
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,.12)",
                  background: "rgba(255,255,255,.04)",
                  color: "rgba(232,236,255,.92)",
                  fontSize: 13,
                  fontWeight: 700,
                }}
                title="Cerrar sesión"
              >
                Cerrar sesión
              </button>
            </div>
          </div>

          <div className="content">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}