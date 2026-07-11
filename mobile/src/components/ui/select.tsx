import { useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import Modal from "react-native-modal";
import { Check, ChevronDown } from "lucide-react-native";
import { cx } from "@/lib/cx";
import { useIconColor } from "@/lib/colors";

export interface SelectOption {
  value: string;
  label: string;
}

// The web's Radix Select forbids empty-string item values, so the port
// represents "no value" (a null category / unassigned) with a sentinel and maps
// it to null on submit. Same convention here.
const NONE = "__none__";

interface SelectProps {
  value: string | null;
  options: SelectOption[];
  onValueChange: (value: string | null) => void;
  placeholder?: string;
  /** Adds a "none" option at the top that clears the value to null. */
  allowNull?: boolean;
  noneLabel?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Bottom-sheet picker — the RN analog of the web's Radix Select (the documented
 * mobile divergence: "bottom sheets / react-native-modal, not Radix dialogs").
 * One component reused for the list filters and every inline ticket-property
 * edit. Backdrop tap or swipe-down dismisses; selecting an option fires
 * onValueChange (null when the "none" option is chosen) and closes.
 */
export function Select({
  value,
  options,
  onValueChange,
  placeholder = "Select…",
  allowNull = false,
  noneLabel = "None",
  disabled = false,
  className,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const muted = useIconColor("muted");
  const foreground = useIconColor("foreground");

  const selected = options.find((o) => o.value === value) ?? null;
  const items: SelectOption[] = [...(allowNull ? [{ value: NONE, label: noneLabel }] : []), ...options];

  function handlePick(next: string) {
    setOpen(false);
    onValueChange(next === NONE ? null : next);
  }

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        disabled={disabled}
        className={cx(
          "flex flex-row items-center justify-between rounded-md border border-input bg-card px-3 py-2.5",
          disabled && "opacity-60",
          className,
        )}
      >
        <Text className={cx("text-sm", selected ? "text-foreground" : "text-muted-foreground")} numberOfLines={1}>
          {selected ? selected.label : placeholder}
        </Text>
        <ChevronDown size={16} color={muted} />
      </Pressable>

      <Modal
        isVisible={open}
        onBackdropPress={() => setOpen(false)}
        onSwipeComplete={() => setOpen(false)}
        swipeDirection="down"
        backdropOpacity={0.4}
        style={{ margin: 0, justifyContent: "flex-end" }}
      >
        <View className="rounded-t-2xl bg-card pb-8">
          <View className="items-center py-2">
            <View className="h-1.5 w-10 rounded-full bg-muted" />
          </View>
          <FlatList
            data={items}
            keyExtractor={(item) => item.value}
            renderItem={({ item }) => {
              const active = item.value === NONE ? value == null : item.value === value;
              return (
                <Pressable
                  onPress={() => handlePick(item.value)}
                  className="flex flex-row items-center justify-between px-5 py-3.5"
                >
                  <Text className={cx("text-base", active ? "font-semibold text-foreground" : "text-foreground")}>
                    {item.label}
                  </Text>
                  {active && <Check size={18} color={foreground} />}
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>
    </>
  );
}
