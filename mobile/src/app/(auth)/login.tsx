import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signIn } from "@/lib/auth";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});
type Values = z.infer<typeof schema>;

/** Email/password sign-in. Registration is closed on the backend — accounts are
 *  provisioned by the seed or an admin, so there's no sign-up flow here (mirrors
 *  the web). On success, useSession() updates reactively and the (auth) group
 *  layout redirects to the app. */
export default function LoginScreen() {
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: Values) => {
    setSubmitting(true);
    setServerError(null);
    const { error } = await signIn.email({ email: values.email, password: values.password });
    setSubmitting(false);
    if (error) setServerError(error.message ?? "Sign-in failed");
    // On success the reactive useSession() in (auth)/_layout.tsx redirects.
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <View className="flex-1 justify-center px-6">
          <Text className="text-3xl font-bold text-foreground">Ticketly</Text>
          <Text className="mt-1 text-muted-foreground">Sign in to your account</Text>

          <View className="mt-8 gap-1">
            <Text className="text-sm font-medium text-foreground">Email</Text>
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="you@example.com"
                  className="rounded-md border border-input bg-card px-3 py-3 text-foreground"
                />
              )}
            />
            {errors.email && <Text className="text-destructive">{errors.email.message}</Text>}
          </View>

          <View className="mt-4 gap-1">
            <Text className="text-sm font-medium text-foreground">Password</Text>
            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  secureTextEntry
                  placeholder="••••••••"
                  className="rounded-md border border-input bg-card px-3 py-3 text-foreground"
                />
              )}
            />
            {errors.password && <Text className="text-destructive">{errors.password.message}</Text>}
          </View>

          {serverError && <Text className="mt-4 text-destructive">{serverError}</Text>}

          <Pressable
            onPress={handleSubmit(onSubmit)}
            disabled={submitting}
            className="mt-6 flex-row items-center justify-center rounded-md bg-primary px-4 py-3 disabled:opacity-60"
          >
            {submitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="font-semibold text-primary-foreground">Sign in</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
