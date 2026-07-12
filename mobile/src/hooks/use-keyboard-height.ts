import { useEffect, useState } from "react";
import { Keyboard, Platform, type KeyboardEvent } from "react-native";
import { Easing, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";

export type KeyboardHeight = {
  /** Animated keyboard height (0 when closed). Drive an animated spacer/padding with it. */
  height: SharedValue<number>;
  /** Plain boolean that re-renders on change — handy for scroll-to-end / focus effects. */
  visible: boolean;
};

/**
 * Animated keyboard height for chat-style "lift the composer above the keyboard" layouts.
 *
 * Subscribes to `keyboardWillShow/Hide` on iOS (fires before the move → buttery sync) and
 * `keyboardDidShow/Hide` on Android (no reliable Will event there; `withTiming` smooths the
 * tail over the platform-reported `e.duration`). Returns a Reanimated shared value so the
 * lift stays on the UI thread, plus a plain `visible` flag for non-animated effects.
 *
 * Pass `{ enabled: false }` to disable the JS lift — e.g. on a platform whose OS window
 * resize already lifts the composer and you're seeing a double-offset.
 */
export function useKeyboardHeight({ enabled = true }: { enabled?: boolean } = {}): KeyboardHeight {
  const height = useSharedValue(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const onShow = (e: KeyboardEvent) => {
      const next = e.endCoordinates?.height ?? 0;
      const duration = e.duration && e.duration > 0 ? e.duration : 250;
      height.value = withTiming(next, { duration, easing: Easing.out(Easing.cubic) });
      setVisible(true);
    };
    const onHide = (e: KeyboardEvent) => {
      const duration = e.duration && e.duration > 0 ? e.duration : 250;
      height.value = withTiming(0, { duration, easing: Easing.in(Easing.cubic) });
      setVisible(false);
    };

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [enabled, height]);

  return { height, visible };
}
