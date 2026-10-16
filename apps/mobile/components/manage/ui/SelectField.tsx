import { useState } from "react";
import { Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { manage } from "./tokens";
import { fieldStyles as fs } from "./fieldStyles";
import { FieldFrame, type FieldFrameProps } from "./FieldFrame";
import { OptionSheet, type SelectOption } from "./OptionSheet";

interface SelectFieldProps extends FieldFrameProps {
  value: string | null;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function SelectField({ label, required, hint, error, value, options, onChange, placeholder = "Select", disabled }: SelectFieldProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <FieldFrame label={label} required={required} hint={hint} error={error}>
      <TouchableOpacity
        style={[fs.box, !!error && fs.boxError, disabled && fs.boxDisabled]}
        onPress={() => setOpen(true)}
        disabled={disabled}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${label ?? "Select"}: ${selected?.label ?? "none"}`}
      >
        <Text style={[fs.text, !selected && fs.placeholder]} numberOfLines={1}>{selected?.label ?? placeholder}</Text>
        <Ionicons name="chevron-down" size={18} color={manage.muted} />
      </TouchableOpacity>
      <OptionSheet visible={open} title={label ?? "Select"} options={options} value={value} onPick={pick} onClose={() => setOpen(false)} />
    </FieldFrame>
  );
}

