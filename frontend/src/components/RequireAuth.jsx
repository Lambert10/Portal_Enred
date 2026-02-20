import React from "react";
import { Navigate, useLocation } from "react-router-dom";

export default function RequireAuth({ children }) {
  const loc = useLocation();

  let ok = false;
  try {
    ok = !!localStorage.getItem("enred_session");
  } catch {
    ok = false;
  }

  if (!ok) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }

  return children;
}