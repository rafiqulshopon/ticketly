import { Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/app-layout";
import { RequireAuth } from "@/components/auth/require-auth";
import { RequireAdmin } from "@/components/auth/require-admin";
import { RoleRedirect } from "@/components/auth/role-redirect";
import { DashboardPage } from "@/routes/dashboard";
import { TicketsPage } from "@/routes/tickets";
import { TicketDetailsPage } from "@/routes/ticket-details";
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
          {/* Role-aware landing: admin → /dashboard, agent → /tickets. */}
          <Route path="/" element={<RoleRedirect />} />
          {/* All staff (admin + agent). */}
          <Route path="/tickets" element={<TicketsPage />} />
          <Route path="/tickets/:id" element={<TicketDetailsPage />} />
          {/* Admin-only routes. */}
          <Route element={<RequireAdmin />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/users" element={<UsersPage />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}
