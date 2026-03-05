import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Home from "./pages/Home";
import Login from "./pages/Login";
import AppLayout from "./components/AppLayout";
import RequireAuth from "./components/RequireAuth";
import RequireAdmin from "./components/RequireAdmin";

import DashboardsList from "./pages/DashboardsList";
import DashboardClient from "./pages/DashboardClient";
import AdminProviders from "./pages/AdminProviders";
import AdminUsersList from "./pages/AdminUsersList";
import AdminUserForm from "./pages/AdminUserForm";
import AdminClientsList from "./pages/AdminClientsList";
import AdminClientForm from "./pages/AdminClientForm";
import AgendaList from "./pages/AgendaList";
import AgendaClient from "./pages/AgendaClient";

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
          <Route path="/agenda" element={<AgendaList />} />
          <Route path="/agenda/:slug" element={<AgendaClient />} />
          <Route
            path="/admin/providers"
            element={
              <RequireAdmin>
                <AdminProviders />
              </RequireAdmin>
            }
          />
          <Route
            path="/admin/users"
            element={
              <RequireAdmin>
                <AdminUsersList />
              </RequireAdmin>
            }
          />
          <Route
            path="/admin/clients"
            element={
              <RequireAdmin>
                <AdminClientsList />
              </RequireAdmin>
            }
          />
          <Route
            path="/admin/clients/new"
            element={
              <RequireAdmin>
                <AdminClientForm />
              </RequireAdmin>
            }
          />
          <Route
            path="/admin/clients/:id"
            element={
              <RequireAdmin>
                <AdminClientForm />
              </RequireAdmin>
            }
          />
          <Route
            path="/admin/users/new"
            element={
              <RequireAdmin>
                <AdminUserForm />
              </RequireAdmin>
            }
          />
          <Route
            path="/admin/users/:id"
            element={
              <RequireAdmin>
                <AdminUserForm />
              </RequireAdmin>
            }
          />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
