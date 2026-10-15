import type { ReactNode } from "react";
import { View, Text } from "react-native";
import { fieldStyles as fs } from "./fieldStyles";

export interface FieldFrameProps {
  label?: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
}

/** Label above, hint or error below — wraps every form control */
export function FieldFrame({ label, required, hint, error, children }: FieldFrameProps & { children: ReactNode }) {
  return (
    <View style={fs.wrap}>
      {label ? <Text style={fs.label}>{label}{required ? <Text style={fs.required}> *</Text> : null}</Text> : null}
      {children}
      {error ? <Text style={fs.error}>{error}</Text> : hint ? <Text style={fs.hint}>{hint}</Text> : null}
    </View>
  );
}
