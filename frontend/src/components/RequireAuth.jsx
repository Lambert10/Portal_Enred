import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { apiGet } from "../lib/api";

function clearAuthStorage() {
  try {
    localStorage.removeItem("enred_token");
    localStorage.removeItem("enred_user");
    localStorage.removeItem("enred_session");
  } catch {
    // ignore
  }
}

export default function RequireAuth({ children }) {
  const loc = useLocation();
  const [checking, setChecking] = useState(true);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function validateAuth() {
      let token = "";
      try {
        token = localStorage.getItem("enred_token") || "";
      } catch {
        token = "";
      }

      if (!token) {
        if (!cancelled) {
          setOk(false);
          setChecking(false);
        }
        return;
      }

      try {
        const data = await apiGet("/api/auth/me");
        if (data?.user) {
          try {
            localStorage.setItem("enred_user", JSON.stringify(data.user));
          } catch {
            // ignore localStorage access errors
          }
        }
        if (!cancelled) {
          setOk(true);
        }
      } catch {
        clearAuthStorage();
        if (!cancelled) {
          setOk(false);
        }
      } finally {
        if (!cancelled) {
          setChecking(false);
        }
      }
    }

    validateAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  if (checking) return null;

  if (!ok) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }

  return children;
}
