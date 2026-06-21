import { Button } from "@/components/ui/button";

export function LoginPage() {
  return (
    <div className="mx-auto max-w-sm space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="text-sm text-muted-foreground">
        The Better Auth sign-in form wires up in Phase 1, once the auth handler is mounted
        on the backend.
      </p>
      <Button disabled>Sign in</Button>
    </div>
  );
}
