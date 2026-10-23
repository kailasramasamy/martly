import { useState } from "react";
import { TextField } from "../../ui/TextField";

interface NumberFieldProps {
  label: string;
  value: number | null;
  /** Null when the box is empty */
  onChange: (value: number | null) => void;
  integer?: boolean;
  prefix?: string;
  suffix?: string;
  placeholder?: string;
  hint?: string;
  error?: string;
}

/** Numeric input that keeps what is typed (including an empty box) and reports the parsed number */
export function NumberField({ label, value, onChange, integer, ...rest }: NumberFieldProps) {
  const [text, setText] = useState(value === null ? "" : String(value));
  const change = (next: string) => {
    setText(next);
    if (next.trim() === "") return onChange(null);
    const n = Number(next.replace(",", "."));
    if (!Number.isNaN(n)) onChange(n);
  };
  return <TextField label={label} value={text} onChangeText={change} keyboardType={integer ? "number-pad" : "decimal-pad"} {...rest} />;
}
