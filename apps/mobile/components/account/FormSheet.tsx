import type { ReactNode } from "react";
import { View, Text, TouchableOpacity, Modal, ActivityIndicator, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../constants/theme";

interface Props {
  visible: boolean;
  title: string;
  submitLabel: string;
  submitting: boolean;
  onSubmit: () => void;
  onClose: () => void;
  children: ReactNode;
}

// Page-sheet form shell shared by the account screen's edit forms
export function FormSheet({ visible, title, submitLabel, submitting, onSubmit, onClose, children }: Props) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <TouchableOpacity style={styles.close} onPress={onClose} accessibilityLabel="Close">
            <Ionicons name="close" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.body}>
          {children}
          <TouchableOpacity
            style={[styles.submit, submitting && { opacity: 0.6 }]}
            onPress={onSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.submitText}>{submitLabel}</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export const formStyles = StyleSheet.create({
  label: { fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginBottom: 8, marginTop: 16 },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, height: 50,
    fontFamily: fonts.medium, fontSize: 16, color: colors.text, backgroundColor: "#fff",
  },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12,
  },
  title: { fontFamily: fonts.extrabold, fontSize: 20, color: colors.text },
  close: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: "#fff",
    borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center",
  },
  body: { paddingHorizontal: 20 },
  submit: {
    height: 52, borderRadius: 14, backgroundColor: colors.primary, marginTop: 28,
    alignItems: "center", justifyContent: "center",
  },
  submitText: { fontFamily: fonts.bold, fontSize: 16, color: "#fff" },
});
