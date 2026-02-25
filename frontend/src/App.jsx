import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Home from "./pages/Home";
import Login from "./pages/Login";
import AppLayout from "./components/AppLayout";
import RequireAuth from "./components/RequireAuth";

import DashboardsList from "./pages/DashboardsList";
import DashboardClient from "./pages/DashboardClient";
import AdminProviders from "./pages/AdminProviders";

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        {/* Público */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />

        {/* Protegido */}
        <Route
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route path="/dashboards" element={<DashboardsList />} />
          <Route path="/dashboard/:slug" element={<DashboardClient />} />
          <Route path="/admin/providers" element={<AdminProviders />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
