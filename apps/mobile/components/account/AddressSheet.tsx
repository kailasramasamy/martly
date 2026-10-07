import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../lib/api";
import { useToast } from "../../lib/toast-context";
import { colors, fonts } from "../../constants/theme";
import { AddressAutocomplete } from "../AddressAutocomplete";
import { FormSheet, formStyles } from "./FormSheet";
import type { UserAddress } from "../../lib/types";

export const ADDRESS_LABELS = ["Home", "Work", "Other"] as const;
export const ADDRESS_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Home: "home-outline",
  Work: "briefcase-outline",
  Other: "location-outline",
};

interface Draft {
  label: string; placeName: string | null; address: string;
  latitude: number | null; longitude: number | null; pincode: string | null; isDefault: boolean;
}

const toDraft = (a: UserAddress | null): Draft => ({
  label: a?.label ?? "Home", placeName: a?.placeName ?? null, address: a?.address ?? "",
  latitude: a?.latitude ?? null, longitude: a?.longitude ?? null, pincode: a?.pincode ?? null, isDefault: a?.isDefault ?? false,
});

const toPayload = (d: Draft) => ({
  label: d.label,
  placeName: d.placeName ?? undefined,
  address: d.address.trim(),
  isDefault: d.isDefault,
  ...(d.latitude != null && d.longitude != null ? { latitude: d.latitude, longitude: d.longitude } : {}),
  ...(d.pincode ? { pincode: d.pincode } : {}),
});

const persist = (address: UserAddress | null, draft: Draft) =>
  address ? api.put(`/api/v1/addresses/${address.id}`, toPayload(draft)) : api.post("/api/v1/addresses", toPayload(draft));

// Resets the draft during render when the sheet opens, so AddressAutocomplete (which reads its
// initial value only on mount) never mounts with the previous draft's text
function useAddressDraft(visible: boolean, address: UserAddress | null) {
  const [draft, setDraft] = useState<Draft>(toDraft(null));
  const openFor = visible ? address?.id ?? "new" : null;
  const [draftFor, setDraftFor] = useState<string | null>(null);
  if (openFor !== draftFor) {
    setDraftFor(openFor);
    if (openFor) setDraft(toDraft(address));
  }
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  return [draft, set] as const;
}

function LabelPicker({ value, onChange }: { value: string; onChange: (label: string) => void }) {
  return (
    <View style={styles.labels}>
      {ADDRESS_LABELS.map((opt) => {
        const active = value === opt;
        return (
          <TouchableOpacity key={opt} style={[styles.chip, active && styles.chipActive]} onPress={() => onChange(opt)}>
            <Ionicons name={ADDRESS_ICONS[opt]} size={15} color={active ? "#fff" : colors.text} />
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

interface Props { visible: boolean; address: UserAddress | null; onClose: () => void; onSaved: () => void }

export function AddressSheet({ visible, address, onClose, onSaved }: Props) {
  const toast = useToast();
  const [draft, set] = useAddressDraft(visible, address);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (draft.address.trim().length < 5) {
      toast.show("Address must be at least 5 characters", "error");
      return;
    }
    setSaving(true);
    try {
      await persist(address, draft);
      onClose();
      onSaved();
    } catch (e: unknown) {
      toast.show(e instanceof Error ? e.message : "Failed to save address", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormSheet
      visible={visible}
      title={address ? "Edit address" : "Add address"}
      submitLabel={address ? "Update address" : "Save address"}
      submitting={saving}
      onSubmit={save}
      onClose={onClose}
    >
      <Text style={formStyles.label}>Save as</Text>
      <LabelPicker value={draft.label} onChange={(label) => set({ label })} />
      <Text style={formStyles.label}>Address</Text>
      <AddressAutocomplete
        placeholder="Search for your address..."
        initialValue={draft.address}
        onSelect={(r) => set({
          address: r.address, latitude: r.latitude || null, longitude: r.longitude || null,
          pincode: r.pincode ?? null, ...(r.placeName ? { placeName: r.placeName } : {}),
        })}
      />
      <TouchableOpacity style={styles.toggle} onPress={() => set({ isDefault: !draft.isDefault })}>
        <Ionicons name={draft.isDefault ? "checkbox" : "square-outline"} size={22} color={draft.isDefault ? colors.primary : "#94a3b8"} />
        <Text style={styles.toggleText}>Set as default address</Text>
      </TouchableOpacity>
    </FormSheet>
  );
}

const styles = StyleSheet.create({
  labels: { flexDirection: "row", gap: 10 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 6, height: 40, paddingHorizontal: 16, borderRadius: 20,
    borderWidth: 1, borderColor: colors.border, backgroundColor: "#fff",
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  chipTextActive: { color: "#fff" },
  toggle: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 18 },
  toggleText: { fontFamily: fonts.medium, fontSize: 15, color: colors.text },
});
