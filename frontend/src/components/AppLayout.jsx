import React, { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

const THEME_STORAGE_KEY = "enred_theme";

function getStoredUser() {
  try {
    const raw = localStorage.getItem("enred_user");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getStoredTheme() {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === "light" || raw === "dark") return raw;
  } catch {
    // ignore
  }

  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: light)").matches) {
    return "light";
  }
  return "dark";
}

export default function AppLayout() {
  const nav = useNavigate();
  const user = useMemo(() => getStoredUser(), []);
  const [theme, setTheme] = useState(getStoredTheme);
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  function toggleTheme() {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }

  function logout() {
    try {
      localStorage.removeItem("enred_token");
      localStorage.removeItem("enred_user");
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
            <div className="brandLogo">
              <img src="/social/enred-logo-share.png" alt="Enred Consultores" />
            </div>
          </div>

          <nav className="nav">
            <NavLink
              to="/dashboards"
              className={({ isActive }) => `navLink ${isActive ? "navLinkActive" : ""}`}
            >
              <span>Dashboards</span>
              <span className="navMeta">Lista</span>
            </NavLink>

            <NavLink to="/agenda" className={({ isActive }) => `navLink ${isActive ? "navLinkActive" : ""}`}>
              <span>Agenda</span>
              <span className="navMeta">Calendario</span>
            </NavLink>

            <NavLink to="/jira" className={({ isActive }) => `navLink ${isActive ? "navLinkActive" : ""}`}>
              <span>Jira</span>
              <span className="navMeta">Issues</span>
            </NavLink>

            {isAdmin && (
              <NavLink
                to="/admin/providers"
                className={({ isActive }) => `navLink ${isActive ? "navLinkActive" : ""}`}
              >
                <span>Admin proveedores</span>
                <span className="navMeta">Config</span>
              </NavLink>
            )}

            {isAdmin && (
              <NavLink
                to="/admin/clients"
                className={({ isActive }) => `navLink ${isActive ? "navLinkActive" : ""}`}
              >
                <span>Admin clientes</span>
                <span className="navMeta">CRUD</span>
              </NavLink>
            )}

            {isAdmin && (
              <NavLink
                to="/admin/users"
                className={({ isActive }) => `navLink ${isActive ? "navLinkActive" : ""}`}
              >
                <span>Admin usuarios</span>
                <span className="navMeta">CRUD</span>
              </NavLink>
            )}
          </nav>

          <div className="sidebarNote">
            Proximo paso: login real + permisos por rol + tokens de acceso por cliente.
          </div>
        </aside>

        <main className="main">
          <div className="topbar">
            <div className="topTitle">
              <h1>Portal Informativo</h1>
              <span>Vista tecnologica / estilo SaaS</span>
            </div>

            <div className="topControls">
              <button
                type="button"
                onClick={toggleTheme}
                className={`themeSwitch ${theme === "light" ? "themeSwitchLight" : ""}`}
                title={theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
                aria-label={theme === "dark" ? "Activar tema claro" : "Activar tema oscuro"}
                aria-pressed={theme === "light"}
              >
                <span className="themeSwitchIcon themeSwitchIconMoon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" role="img" focusable="false">
                    <path
                      d="M21 14.6A9 9 0 1 1 12.4 3a7.2 7.2 0 1 0 8.6 11.6Z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span className="themeSwitchIcon themeSwitchIconSun" aria-hidden="true">
                  <svg viewBox="0 0 24 24" role="img" focusable="false">
                    <circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
                    <path
                      d="M12 2.7v2.1M12 19.2v2.1M21.3 12h-2.1M4.8 12H2.7M18.7 5.3l-1.5 1.5M6.8 17.2l-1.5 1.5M18.7 18.7l-1.5-1.5M6.8 6.8 5.3 5.3"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
                <span className="themeSwitchThumb" aria-hidden="true" />
              </button>

              <div className="search">
                <span style={{ opacity: 0.75 }}>Q</span>
                <input placeholder="Buscar (proximamente global)..." disabled />
              </div>

              <button
                onClick={logout}
                className="topBtn topBtnLogout"
                title="Cerrar sesion"
              >
                Cerrar sesion
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
