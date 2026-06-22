import { Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/app-layout";
import { RequireAuth } from "@/components/auth/require-auth";
import { DashboardPage } from "@/routes/dashboard";
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
        </Route>
      </Route>
    </Routes>
  );
}
