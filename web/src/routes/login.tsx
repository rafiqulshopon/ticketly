import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";
import { signIn, useSession } from "@/lib/auth";
import { LogoMark } from "@/components/brand/logo";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@/components/ui";

const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { data: session, isPending } = useSession();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  // Already signed in — no reason to show the form.
  if (!isPending && session) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(values: LoginValues) {
    const { error: signInError } = await signIn.email({
      email: values.email,
      password: values.password,
    });

    if (signInError) {
      setError("root", {
        message: signInError.message ?? "Unable to sign in. Please try again.",
      });
      return;
    }

    // useSession() updates reactively and drives the nav; navigate to home.
    navigate("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <LogoMark className="size-12" />
        </div>
        <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Sign in</CardTitle>
          <CardDescription>Enter your credentials to access Ticketly.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                aria-invalid={errors.email ? true : undefined}
                disabled={isSubmitting}
                {...register("email")}
              />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                aria-invalid={errors.password ? true : undefined}
                disabled={isSubmitting}
                {...register("password")}
              />
              {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
            </div>

            {errors.root && <p className="text-sm text-destructive">{errors.root.message}</p>}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </CardContent>
        </Card>
      </div>
    </div>
  );
}
