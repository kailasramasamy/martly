import { useEffect, useState } from "react";
import { Text, TextInput } from "react-native";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { useToast } from "../../lib/toast-context";
import { FormSheet, formStyles } from "./FormSheet";

export function EditProfileSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName(user?.name ?? "");
    setPhone(user?.phone ?? "");
  }, [visible, user]);

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/api/v1/auth/profile", { name: name.trim(), phone: phone.trim() || undefined });
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
      <TextInput
        style={formStyles.input}
        value={phone}
        onChangeText={setPhone}
        placeholder="Phone number"
        placeholderTextColor="#94a3b8"
        keyboardType="phone-pad"
      />
    </FormSheet>
  );
}
