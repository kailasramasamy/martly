import { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../lib/api";
import { colors, spacing, fontSize } from "../constants/theme";
import { AddressAutocomplete } from "./AddressAutocomplete";

interface ProfileGateProps {
  visible: boolean;
  onComplete: () => void;
  onDismiss: () => void;
}

const LABEL_OPTIONS = ["Home", "Work", "Other"] as const;
const LABEL_ICONS: Record<string, string> = {
  Home: "home-outline",
  Work: "briefcase-outline",
  Other: "location-outline",
};

export function ProfileGate({ visible, onComplete, onDismiss }: ProfileGateProps) {
  const [label, setLabel] = useState<string>("Home");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [pincode, setPincode] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setLabel("Home");
      setAddress("");
      setLatitude(null);
      setLongitude(null);
      setPincode(null);
      setSaving(false);
      setError("");
    }
  }, [visible]);

  const handleSave = async () => {
    if (address.trim().length < 5) {
      setError("Please select or search for your address");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const payload: Record<string, unknown> = {
        label,
        address: address.trim(),
        ...(latitude != null && longitude != null ? { latitude, longitude } : {}),
        ...(pincode ? { pincode } : {}),
      };
      await api.post("/api/v1/addresses", payload);
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save address");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onDismiss}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onDismiss} />

        <View style={styles.sheet}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Close */}
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onDismiss}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </TouchableOpacity>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.iconRow}>
              <View style={styles.iconCircle}>
                <Ionicons name="location-outline" size={24} color={colors.primary} />
              </View>
            </View>
            <Text style={styles.sheetTitle}>Add your delivery address</Text>
            <Text style={styles.sheetSubtitle}>
              We need your address to check delivery availability and calculate fees
            </Text>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            {/* Label picker */}
            <Text style={styles.fieldLabel}>Address type</Text>
            <View style={styles.labelPicker}>
              {LABEL_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.labelChip, label === opt && styles.labelChipActive]}
                  onPress={() => setLabel(opt)}
                >
                  <Ionicons
                    name={(LABEL_ICONS[opt] ?? "location-outline") as any}
                    size={14}
                    color={label === opt ? "#fff" : colors.text}
                  />
                  <Text style={[styles.labelChipText, label === opt && styles.labelChipTextActive]}>
                    {opt}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Address autocomplete */}
            <Text style={styles.fieldLabel}>Address</Text>
            <AddressAutocomplete
              placeholder="Search for your address..."
              onSelect={(result) => {
                setAddress(result.address);
                setLatitude(result.latitude || null);
                setLongitude(result.longitude || null);
                setPincode(result.pincode ?? null);
                if (result.placeName) setLabel(result.placeName);
                setError("");
              }}
            />

            {/* Selected address preview */}
            {address.length > 0 && (
              <View style={styles.selectedPreview}>
                <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                <Text style={styles.selectedText} numberOfLines={2}>{address}</Text>
              </View>
            )}

            {/* Save button */}
            <TouchableOpacity
              style={[styles.button, (saving || address.length < 5) && styles.buttonDisabled]}
              onPress={handleSave}
              disabled={saving || address.length < 5}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.buttonText}>Save & Continue</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
    paddingTop: 12,
    maxHeight: "85%",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#e2e8f0",
    alignSelf: "center",
    marginBottom: 16,
  },
  closeBtn: { position: "absolute", top: 16, right: 16, zIndex: 1 },

  iconRow: { alignItems: "center", marginBottom: 12 },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.primary + "14",
    justifyContent: "center",
    alignItems: "center",
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  sheetSubtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 20,
    lineHeight: 20,
  },

  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: 8,
    marginTop: 4,
  },

  labelPicker: { flexDirection: "row", gap: 8, marginBottom: 16 },
  labelChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
  },
  labelChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  labelChipText: { fontSize: 13, fontWeight: "600", color: colors.text },
  labelChipTextActive: { color: "#fff" },

  selectedPreview: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 12,
    backgroundColor: colors.primary + "08",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary + "20",
    padding: 12,
  },
  selectedText: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },

  button: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 20,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontSize: fontSize.lg, fontWeight: "700" },

  error: {
    color: colors.error,
    textAlign: "center",
    marginBottom: 12,
    fontSize: fontSize.md,
  },
});
