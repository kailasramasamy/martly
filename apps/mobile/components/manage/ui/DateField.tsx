import { useState } from "react";
import { Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheet } from "../../search/BottomSheet";
import { manage } from "./tokens";
import { fieldStyles as fs } from "./fieldStyles";
import { FieldFrame, type FieldFrameProps } from "./FieldFrame";
import { CalendarGrid } from "./CalendarGrid";
import { formatDate, fromDateKey } from "./dates";

interface DateFieldProps extends FieldFrameProps {
  /** "YYYY-MM-DD" or null */
  value: string | null;
  onChange: (dateKey: string) => void;
  placeholder?: string;
  minDate?: string;
}

export function DateField({ label, required, hint, error, value, onChange, placeholder = "Pick a date", minDate }: DateFieldProps) {
  const [open, setOpen] = useState(false);
  return (
    <FieldFrame label={label} required={required} hint={hint} error={error}>
      <TouchableOpacity style={[fs.box, !!error && fs.boxError]} onPress={() => setOpen(true)} activeOpacity={0.7} accessibilityRole="button">
        <Text style={[fs.text, !value && fs.placeholder]}>{value ? formatDate(fromDateKey(value)) : placeholder}</Text>
        <Ionicons name="calendar-outline" size={18} color={manage.muted} />
      </TouchableOpacity>
      <BottomSheet visible={open} title={label ?? "Pick a date"} onClose={() => setOpen(false)}>
        <CalendarGrid value={value} minDate={minDate} onSelect={(d) => { onChange(d); setOpen(false); }} />
      </BottomSheet>
    </FieldFrame>
  );
}
