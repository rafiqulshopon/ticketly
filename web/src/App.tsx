import { Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/app-layout";
import { RequireAuth } from "@/components/auth/require-auth";
import { RequireAdmin } from "@/components/auth/require-admin";
import { DashboardPage } from "@/routes/dashboard";
import { TicketsPage } from "@/routes/tickets";
import { UsersPage } from "@/routes/users";
import { LoginPage } from "@/routes/login";

export default function App() {
  return (
    <Routes>
      {/* Standalone login page (no app nav). */}
      <Route path="/login" element={<LoginPage />} />
      {/* Authenticated routes: guarded shell + outlet. */}
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          {/* All staff (admin + agent). */}
          <Route path="/tickets" element={<TicketsPage />} />
          {/* Admin-only routes. */}
          <Route element={<RequireAdmin />}>
            <Route path="/users" element={<UsersPage />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}
