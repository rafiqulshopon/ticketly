import { useEffect, useState } from "react";
import { Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/app-layout";
import { DashboardPage } from "@/routes/dashboard";
import { LoginPage } from "@/routes/login";
import { getHealth } from "@/lib/api";

type HealthState =
  | { kind: "loading" }
  | { kind: "ok"; message: string }
  | { kind: "error"; message: string };

export default function App() {
  const [health, setHealth] = useState<HealthState>({ kind: "loading" });

  useEffect(() => {
    let active = true;
    getHealth()
      .then((res) => {
        if (active) setHealth({ kind: "ok", message: `${res.service} — ${res.status}` });
      })
      .catch((err: unknown) => {
        if (!active) return;
        setHealth({ kind: "error", message: err instanceof Error ? err.message : "request failed" });
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <HealthBanner health={health} />
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/login" element={<LoginPage />} />
        </Route>
      </Routes>
    </>
  );
}

function HealthBanner({ health }: { health: HealthState }) {
  if (health.kind === "loading") {
    return <div className="bg-muted py-1.5 text-center text-sm text-muted-foreground">Checking API…</div>;
  }
  if (health.kind === "ok") {
    return (
      <div className="bg-emerald-500/10 py-1.5 text-center text-sm text-emerald-700 dark:text-emerald-400">
        ✓ API online — {health.message}
      </div>
    );
  }
  return (
    <div className="bg-destructive/10 py-1.5 text-center text-sm text-destructive">
      ✕ API unreachable — {health.message}
    </div>
  );
}
