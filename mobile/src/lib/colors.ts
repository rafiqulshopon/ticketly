import { useColorScheme } from "react-native";

// lucide-react-native's `color` prop takes a literal hex string — it can't read
// the NativeWind CSS-variable tokens the rest of the UI composes with. These
// values mirror src/global.css so icon strokes stay on-palette and adapt to the
// system color scheme. Keep in sync with global.css if a token value changes.

const LIGHT = {
  foreground: "#0b1220",
  muted: "#5b6776",
  primary: "#0b1220",
  ai: "#0e9f6e",
  destructive: "#dc2626",
  info: "#2563eb",
} as const;

const DARK = {
  foreground: "#e8edf6",
  muted: "#94a3b8",
  primary: "#e8edf6",
  ai: "#34d399",
  destructive: "#f87171",
  info: "#60a5fa",
} as const;

export type IconColor = keyof typeof LIGHT;

/** Resolve a token color for an icon stroke in the current color scheme. */
export function useIconColor(color: IconColor): string {
  const scheme = useColorScheme();
  return (scheme === "dark" ? DARK : LIGHT)[color];
}
