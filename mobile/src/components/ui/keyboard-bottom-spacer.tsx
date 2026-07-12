import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";

/**
 * Animated spacer that grows from 0 to the keyboard height. Place it as the LAST
 * child of a flex-1 column (directly under the composer) so the composer is pushed
 * flush to the keyboard's top edge. `pointerEvents="none"` so it never swallows
 * taps. Driven by the shared value returned from `useKeyboardHeight`.
 */
export function KeyboardBottomSpacer({ height }: { height: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({ height: height.value }));
  return <Animated.View style={style} pointerEvents="none" />;
}
