import { View, Text, TextInput, StyleSheet, type KeyboardTypeOptions } from "react-native";
import { fonts } from "../../../constants/theme";
import { manage } from "./tokens";
import { fieldStyles as fs } from "./fieldStyles";
import { FieldFrame, type FieldFrameProps } from "./FieldFrame";

interface TextFieldProps extends FieldFrameProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  /** Leading unit, e.g. "₹" for money */
  prefix?: string;
  /** Trailing unit, e.g. "%" or "km" */
  suffix?: string;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  editable?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  secureTextEntry?: boolean;
  maxLength?: number;
}

export function TextField({ label, required, hint, error, prefix, suffix, multiline, editable = true, ...input }: TextFieldProps) {
  return (
    <FieldFrame label={label} required={required} hint={hint} error={error}>
      <View style={[fs.box, multiline && styles.multiBox, !!error && fs.boxError, !editable && fs.boxDisabled]}>
        {prefix ? <Text style={styles.affix}>{prefix}</Text> : null}
        <TextInput
          {...input}
          editable={editable}
          multiline={multiline}
          style={[fs.text, multiline && styles.multiText]}
          placeholderTextColor={manage.muted}
          textAlignVertical={multiline ? "top" : "center"}
          accessibilityLabel={label}
        />
        {suffix ? <Text style={styles.affix}>{suffix}</Text> : null}
      </View>
    </FieldFrame>
  );
}

const styles = StyleSheet.create({
  affix: { fontFamily: fonts.bold, fontSize: 15, color: manage.muted, marginHorizontal: 4 },
  multiBox: { alignItems: "flex-start", paddingVertical: 10 },
  multiText: { minHeight: 84 },
});
