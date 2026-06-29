import { useState } from "react";
import { Outlet, Link, NavLink, useNavigate } from "react-router-dom";
import { Inbox, LayoutDashboard, LogOut, Users } from "lucide-react";
import { signOut, useSession } from "@/lib/auth";
import { Avatar, AvatarFallback, Button } from "@/components/ui";
import { Brand } from "@/components/brand/logo";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { useRealtimeEvents } from "@/hooks/use-realtime-events";
import { cn } from "@/lib/utils";

type NavItem = {
  to: string;
  label: string;
  icon: typeof Inbox;
};

/** Active link = quiet filled surface; the page content stays the loud part. */
const navItemBase =
  "flex items-center gap-3 rounded-md px-3 text-sm transition-colors";

function initials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export function AppLayout() {
  const { data: session } = useSession();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  // One SSE connection for the whole authenticated session: live ticket replies
  // (appended to an open thread / toasted) and new tickets (toasted). Opens on
  // mount (behind RequireAuth) and closes on sign-out.
  useRealtimeEvents();

  async function onSignOut() {
    setSigningOut(true);
    await signOut({ fetchOptions: { onSuccess: () => navigate("/login") } });
    setSigningOut(false);
  }

  const isAdmin = session?.user?.role === "admin";

  // Overview first, then the ticket queue, then people management. The queue is
  // the only item agents see.
  const navItems: NavItem[] = [
    ...(isAdmin ? [{ to: "/dashboard", label: "Dashboard", icon: LayoutDashboard }] : []),
    { to: "/tickets", label: "Tickets", icon: Inbox },
    ...(isAdmin ? [{ to: "/users", label: "Users", icon: Users }] : []),
  ];

  const user = session?.user;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex">
        {/* Sidebar — persistent workspace rail on large screens. */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r bg-card/40 lg:flex">
          <div className="flex h-16 items-center justify-between border-b px-5">
            <Link to="/">
              <Brand />
            </Link>
            {user && <NotificationBell align="start" />}
          </div>
          <nav className="flex-1 space-y-1 p-3">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    navItemBase,
                    "h-9",
                    isActive
                      ? "bg-secondary font-medium text-foreground"
                      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                  )
                }
              >
                <item.icon className="size-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>
          {user && (
            <div className="border-t p-3">
              <UserBlock
                name={user.name}
                role={user.role}
                onSignOut={onSignOut}
                signingOut={signingOut}
              />
            </div>
          )}
        </aside>

        {/* Main column. */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Mobile top bar + nav (sidebar collapses up top below lg). */}
          <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur lg:hidden">
            <div className="flex h-14 items-center gap-1 px-4">
              <Link to="/" className="mr-auto">
                <Brand />
              </Link>
              {user && <NotificationBell align="end" />}
              {user ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onSignOut}
                  disabled={signingOut}
                >
                  <LogOut className="size-4" />
                  {signingOut ? "Signing out…" : "Sign out"}
                </Button>
              ) : (
                <Button variant="outline" size="sm" asChild>
                  <Link to="/login">Sign in</Link>
                </Button>
              )}
            </div>
            <nav className="flex gap-1 overflow-x-auto px-2 pb-2">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      navItemBase,
                      "h-8 whitespace-nowrap",
                      isActive
                        ? "bg-secondary font-medium text-foreground"
                        : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                    )
                  }
                >
                  <item.icon className="size-4" />
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </header>

          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-10">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}

function UserBlock({
  name,
  role,
  onSignOut,
  signingOut,
}: {
  name?: string | null;
  role?: string | null;
  onSignOut: () => void;
  signingOut: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md px-1 py-1">
      <Avatar className="size-9 border">
        <AvatarFallback className="bg-muted text-muted-foreground">{initials(name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{name ?? "Account"}</p>
        <p className="truncate text-xs capitalize text-muted-foreground">{role ?? "user"}</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="size-8 text-muted-foreground hover:text-foreground"
        onClick={onSignOut}
        disabled={signingOut}
        aria-label="Sign out"
      >
        <LogOut className="size-4" />
      </Button>
    </div>
  );
}
