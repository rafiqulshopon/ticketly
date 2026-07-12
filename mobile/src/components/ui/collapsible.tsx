import { useState } from "react";
import { LayoutAnimation, Platform, UIManager, View } from "react-native";
import { ChevronDown } from "lucide-react-native";
import { useIconColor } from "@/lib/colors";

// LayoutAnimation must be explicitly enabled on Android (it's on by default on iOS).
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/** Open/closed state for a collapsible section. `toggle`/`animateTo` schedule a
 *  native LayoutAnimation (easeInEaseOut) before changing state, so the body's
 *  show/hide animates without measuring height or driving a JS animation.
 *  `setOpen` skips the animation (for programmatic changes where you don't want
 *  the spring). */
export function useCollapsible(initial = false) {
  const [open, setOpen] = useState(initial);

  function toggle() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((o) => !o);
  }

  function animateTo(next: boolean) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen(next);
  }

  return { open, toggle, setOpen, animateTo };
}

/** A chevron that flips 180° to mirror open/closed state. Uses an inline
 *  transform style — not a NativeWind `rotate-*` className (which throws when
 *  toggled under the NativeWind + React Compiler pipeline) and not an
 *  Animated.Value (which would force a useState/useRef container). It snaps;
 *  the section body is what animates, via LayoutAnimation in useCollapsible. */
export function CollapseChevron({ open, size = 18 }: { open: boolean; size?: number }) {
  const color = useIconColor("muted");
  return (
    <View style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}>
      <ChevronDown size={size} color={color} />
    </View>
  );
}
