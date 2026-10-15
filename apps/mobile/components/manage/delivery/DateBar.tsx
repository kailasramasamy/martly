import { useState } from "react";
import { View } from "react-native";
import { DateField } from "../ui/DateField";
import { SegmentedTabs } from "../ui/SegmentedTabs";
import { toDateKey } from "../ui/dates";

type Mode = "today" | "tomorrow" | "pick";

interface DateBarProps {
  value: string;
  onChange: (dateKey: string) => void;
}

function offsetKey(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

export function DateBar({ value, onChange }: DateBarProps) {
  const [mode, setMode] = useState<Mode>("today");

  const pick = (next: Mode) => {
    setMode(next);
    if (next === "today") onChange(offsetKey(0));
    if (next === "tomorrow") onChange(offsetKey(1));
  };

  return (
    <View style={{ gap: 10 }}>
      <SegmentedTabs
        value={mode}
        onChange={pick}
        options={[
          { value: "today", label: "Today" },
          { value: "tomorrow", label: "Tomorrow" },
          { value: "pick", label: "Pick a date" },
        ]}
      />
      {mode === "pick" && <DateField value={value} onChange={onChange} />}
    </View>
  );
}
