import type { ReactNode } from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, fonts } from "../../../constants/theme";
import { BottomSheet } from "../../search/BottomSheet";
import { Button } from "./Button";

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  /** Defaults to "Cancel"; use e.g. "Keep order" when the action itself is a cancellation */
  cancelLabel?: string;
  confirmVariant?: "danger" | "primary";
  running?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  /** Extra inputs under the message, e.g. a required rejection note */
  children?: ReactNode;
}

/** Confirmation on the modal BottomSheet, so it covers the screen even when rendered inside a scroll view */
export function ConfirmDialog({ visible, title, message, confirmLabel, cancelLabel = "Cancel", confirmVariant = "danger", running, onConfirm, onClose, children }: ConfirmDialogProps) {
  return (
    <BottomSheet
      visible={visible}
      title={title}
      onClose={onClose}
      footer={
        <View style={styles.footer}>
          <Button label={cancelLabel} variant="secondary" onPress={onClose} style={styles.btn} disabled={running} />
          <Button label={confirmLabel} variant={confirmVariant} onPress={onConfirm} loading={running} style={styles.btn} />
        </View>
      }
    >
      <View style={styles.body}>
        <Text style={styles.message}>{message}</Text>
        {children}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  footer: { flexDirection: "row", gap: 10, paddingBottom: 8 },
  btn: { flex: 1 },
  body: { paddingBottom: 12, gap: 12 },
  message: { fontFamily: fonts.medium, fontSize: 14.5, lineHeight: 21, color: colors.textSecondary },
});
