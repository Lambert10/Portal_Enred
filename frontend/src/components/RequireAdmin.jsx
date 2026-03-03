import React from "react";
import { Navigate } from "react-router-dom";

function getStoredUser() {
  try {
    const raw = localStorage.getItem("enred_user");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default function RequireAdmin({ children }) {
  const user = getStoredUser();

  if (user?.role !== "admin") {
    return <Navigate to="/dashboards" replace />;
  }

  return children;
}
