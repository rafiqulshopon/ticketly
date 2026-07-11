import { type ReactNode } from "react";
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, Text, View } from "react-native";
import ReactNativeModal from "react-native-modal";
import { X } from "lucide-react-native";
import { useIconColor } from "@/lib/colors";

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children: ReactNode;
  /** Lifts the panel above the keyboard (form variant). Wraps the body in a
   *  KeyboardAvoidingView (behavior="padding") and dismisses the keyboard on
   *  close. No ScrollView — a bounded-height ScrollView inside a centered modal
   *  can collapse and hide its content, and a 3-field form doesn't need to scroll. */
  avoidKeyboard?: boolean;
}

/** Centered dialog built on react-native-modal — the RN analog of the web's
 *  Radix Dialog/AlertDialog. Mirrors the Select's backdrop/swipe dismiss but
 *  centers instead of docking to the bottom, which reads as a confirm/form and
 *  lifts cleanly above the keyboard. */
export function Modal({ open, onOpenChange, title, description, children, avoidKeyboard = false }: ModalProps) {
  const closeColor = useIconColor("muted");

  function close() {
    if (avoidKeyboard) Keyboard.dismiss();
    onOpenChange(false);
  }

  const body = (
    <View className="w-[92%] max-w-md rounded-xl bg-card p-5">
      <View className="flex flex-row items-start justify-between gap-3">
        <View className="flex-1">
          {title ? <Text className="text-lg font-semibold text-foreground">{title}</Text> : null}
          {description ? <Text className="mt-1 text-sm text-muted-foreground">{description}</Text> : null}
        </View>
        <Pressable onPress={close} hitSlop={8} accessibilityLabel="Close">
          <X size={18} color={closeColor} />
        </Pressable>
      </View>
      <View className="mt-5">{children}</View>
    </View>
  );

  return (
    <ReactNativeModal
      isVisible={open}
      onBackdropPress={close}
      onSwipeComplete={close}
      swipeDirection="down"
      backdropOpacity={0.4}
      style={{ margin: 0, alignItems: "center", justifyContent: "center" }}
    >
      {avoidKeyboard ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ width: "100%", alignItems: "center" }}
        >
          {body}
        </KeyboardAvoidingView>
      ) : (
        body
      )}
    </ReactNativeModal>
  );
}
