import { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { useToast } from "../../lib/toast-context";
import { usePhoneChange } from "../../lib/use-phone-change";
import { colors, fonts } from "../../constants/theme";
import { FormSheet, formStyles } from "./FormSheet";

/** Current number with a Change link; changing it sends a code to the new number and saves once verified */
function PhoneField() {
  const { user } = useAuth();
  const change = usePhoneChange();

  if (change.step === "idle") {
    return (
      <View style={styles.phoneRow}>
        <Text style={styles.phoneValue}>{user?.phone || "No phone added"}</Text>
        <TouchableOpacity onPress={change.start} hitSlop={12} accessibilityRole="button">
          <Text style={styles.link}>{user?.phone ? "Change" : "Add"}</Text>
        </TouchableOpacity>
      </View>
    );
  }
  const onCode = change.step === "code";
  return (
    <View>
      <TextInput
        style={formStyles.input}
        value={onCode ? change.code : change.phone}
        onChangeText={onCode ? change.setCode : change.setPhone}
        placeholder={onCode ? `6-digit code sent to ${change.phone}` : "New 10-digit mobile number"}
        placeholderTextColor="#94a3b8"
        keyboardType="number-pad"
        maxLength={onCode ? 6 : 15}
        autoFocus
      />
      <View style={styles.phoneActions}>
        <TouchableOpacity onPress={change.cancel} hitSlop={12}><Text style={styles.muted}>Cancel</Text></TouchableOpacity>
        <TouchableOpacity onPress={onCode ? change.verify : change.sendCode} disabled={change.busy} hitSlop={12}>
          <Text style={[styles.link, change.busy && { opacity: 0.5 }]}>{onCode ? "Verify & save" : "Send code"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function EditProfileSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) setName(user?.name ?? "");
  }, [visible, user?.name]);

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/api/v1/auth/profile", { name: name.trim() });
      await refreshUser();
      onClose();
    } catch (e: unknown) {
      toast.show(e instanceof Error ? e.message : "Failed to update profile", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormSheet visible={visible} title="Edit profile" submitLabel="Save changes" submitting={saving} onSubmit={save} onClose={onClose}>
      <Text style={formStyles.label}>Name</Text>
      <TextInput style={formStyles.input} value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor="#94a3b8" />
      <Text style={formStyles.label}>Phone</Text>
      {visible && <PhoneField />}
    </FormSheet>
  );
}

const styles = StyleSheet.create({
  phoneRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 50, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 12 },
  phoneValue: { fontFamily: fonts.medium, fontSize: 16, color: colors.text },
  phoneActions: { flexDirection: "row", justifyContent: "space-between", paddingTop: 12, paddingHorizontal: 4 },
  link: { fontFamily: fonts.bold, fontSize: 14, color: colors.primary },
  muted: { fontFamily: fonts.semibold, fontSize: 14, color: colors.textSecondary },
});
