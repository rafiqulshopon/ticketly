import { Pressable, Text, View } from "react-native";
import { cx } from "@/lib/cx";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedProps<T extends string> {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
}

/** Two-or-more-option pill toggle — the RN analog of the web's shadcn Tabs
 *  (used for the Conversation / Activity split on the ticket detail). */
export function Segmented<T extends string>({ value, options, onChange }: SegmentedProps<T>) {
  return (
    <View className="flex flex-row rounded-lg bg-secondary p-1">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            className={cx("flex-1 items-center rounded-md py-2", active ? "bg-card" : "bg-transparent")}
          >
            <Text className={cx("text-sm font-medium", active ? "text-foreground" : "text-muted-foreground")}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
