import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Modal,
  Alert,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../lib/auth-context";
import { api } from "../../lib/api";
import { colors, spacing, fontSize } from "../../constants/theme";
import type { UserAddress } from "../../lib/types";

const MAX_ADDRESSES = 5;
const LABEL_OPTIONS = ["Home", "Work", "Other"] as const;
const LABEL_ICONS: Record<string, string> = {
  Home: "home-outline",
  Work: "briefcase-outline",
  Other: "location-outline",
};

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { logout, user, isAuthenticated, refreshUser } = useAuth();

  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);

  // Edit profile state
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Address modal state
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState<UserAddress | null>(null);
  const [addrLabel, setAddrLabel] = useState<string>("Home");
  const [addrText, setAddrText] = useState("");
  const [addrDefault, setAddrDefault] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);

  const fetchAddresses = useCallback(async () => {
    setLoadingAddresses(true);
    try {
      const res = await api.get<UserAddress[]>("/api/v1/addresses");
      setAddresses(res.data);
    } catch {
      // silently fail
    } finally {
      setLoadingAddresses(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchAddresses();
    }
  }, [isAuthenticated, fetchAddresses]);

  const handleLogout = async () => {
    await logout();
    router.replace("/(auth)/login");
  };

  const openEditProfile = () => {
    setEditName(user?.name ?? "");
    setEditPhone(user?.phone ?? "");
    setShowEditProfile(true);
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await api.put("/api/v1/auth/profile", {
        name: editName.trim(),
        phone: editPhone.trim() || undefined,
      });
      await refreshUser();
      setShowEditProfile(false);
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const openAddAddress = () => {
    if (addresses.length >= MAX_ADDRESSES) {
      Alert.alert("Limit Reached", `You can save up to ${MAX_ADDRESSES} addresses.`);
      return;
    }
    setEditingAddress(null);
    setAddrLabel("Home");
    setAddrText("");
    setAddrDefault(false);
    setShowAddressModal(true);
  };

  const openEditAddress = (addr: UserAddress) => {
    setEditingAddress(addr);
    setAddrLabel(addr.label);
    setAddrText(addr.address);
    setAddrDefault(addr.isDefault);
    setShowAddressModal(true);
  };

  const handleSaveAddress = async () => {
    if (addrText.trim().length < 5) {
      Alert.alert("Error", "Address must be at least 5 characters");
      return;
    }
    setSavingAddress(true);
    try {
      const payload = { label: addrLabel, address: addrText.trim(), isDefault: addrDefault };
      if (editingAddress) {
        await api.put(`/api/v1/addresses/${editingAddress.id}`, payload);
      } else {
        await api.post("/api/v1/addresses", payload);
      }
      setShowAddressModal(false);
      fetchAddresses();
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to save address");
    } finally {
      setSavingAddress(false);
    }
  };

  const handleDeleteAddress = (addr: UserAddress) => {
    Alert.alert("Delete Address", `Remove "${addr.label}" address?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/api/v1/addresses/${addr.id}`);
            fetchAddresses();
          } catch {
            Alert.alert("Error", "Failed to delete address");
          }
        },
      },
    ]);
  };

  if (!isAuthenticated) {
    return (
      <View style={styles.authContainer}>
        <View style={styles.authCard}>
          <View style={styles.authIconCircle}>
            <Ionicons name="person-outline" size={36} color={colors.primary} />
          </View>
          <Text style={styles.authTitle}>Sign In to Martly</Text>
          <Text style={styles.authSubtitle}>Manage orders, addresses, and profile</Text>
          <TouchableOpacity style={styles.authBtn} onPress={() => router.push("/(auth)/login")}>
            <Text style={styles.authBtnText}>Sign In</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.authSecondaryBtn} onPress={() => router.push("/(auth)/register")}>
            <Text style={styles.authSecondaryBtnText}>Create Account</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const initials = (user?.name ?? "U")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Avatar + Info */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.profileName}>{user?.name}</Text>
          <Text style={styles.profileDetail}>{user?.email}</Text>
          {user?.phone ? <Text style={styles.profileDetail}>{user.phone}</Text> : null}
          <TouchableOpacity style={styles.editProfileBtn} onPress={openEditProfile}>
            <Ionicons name="create-outline" size={14} color={colors.primary} />
            <Text style={styles.editProfileBtnText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Saved Addresses */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="location-outline" size={18} color={colors.text} />
              <Text style={styles.sectionTitle}>Saved Addresses</Text>
            </View>
            <TouchableOpacity onPress={openAddAddress}>
              <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {loadingAddresses ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
          ) : addresses.length === 0 ? (
            <View style={styles.emptyAddresses}>
              <Ionicons name="map-outline" size={28} color="#94a3b8" />
              <Text style={styles.emptyText}>No saved addresses</Text>
              <TouchableOpacity style={styles.addAddressBtn} onPress={openAddAddress}>
                <Ionicons name="add" size={16} color="#fff" />
                <Text style={styles.addAddressBtnText}>Add Address</Text>
              </TouchableOpacity>
            </View>
          ) : (
            addresses.map((addr) => (
              <View key={addr.id} style={styles.addressCard}>
                <View style={styles.addressIconWrap}>
                  <Ionicons
                    name={(LABEL_ICONS[addr.label] ?? "location-outline") as any}
                    size={18}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.addressInfo}>
                  <View style={styles.addressLabelRow}>
                    <Text style={styles.addressLabel}>{addr.label}</Text>
                    {addr.isDefault && (
                      <View style={styles.defaultBadge}>
                        <Text style={styles.defaultBadgeText}>Default</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.addressText} numberOfLines={2}>
                    {addr.address}
                  </Text>
                </View>
                <View style={styles.addressActions}>
                  <TouchableOpacity onPress={() => openEditAddress(addr)} style={styles.addressActionBtn}>
                    <Ionicons name="create-outline" size={16} color="#64748b" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDeleteAddress(addr)} style={styles.addressActionBtn}>
                    <Ionicons name="trash-outline" size={16} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Sign Out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={18} color="#ef4444" />
          <Text style={styles.signOutBtnText}>Sign Out</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={showEditProfile} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setShowEditProfile(false)}
            >
              <Ionicons name="close" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>
          <View style={styles.modalBody}>
            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              style={styles.input}
              value={editName}
              onChangeText={setEditName}
              placeholder="Your name"
              placeholderTextColor="#94a3b8"
            />
            <Text style={styles.inputLabel}>Phone</Text>
            <TextInput
              style={styles.input}
              value={editPhone}
              onChangeText={setEditPhone}
              placeholder="Phone number"
              placeholderTextColor="#94a3b8"
              keyboardType="phone-pad"
            />
            <TouchableOpacity
              style={[styles.saveBtn, savingProfile && { opacity: 0.6 }]}
              onPress={handleSaveProfile}
              disabled={savingProfile}
            >
              {savingProfile ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.saveBtnText}>Save Changes</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add/Edit Address Modal */}
      <Modal visible={showAddressModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {editingAddress ? "Edit Address" : "Add Address"}
            </Text>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setShowAddressModal(false)}
            >
              <Ionicons name="close" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>
          <View style={styles.modalBody}>
            <Text style={styles.inputLabel}>Label</Text>
            <View style={styles.labelPicker}>
              {LABEL_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.labelChip, addrLabel === opt && styles.labelChipActive]}
                  onPress={() => setAddrLabel(opt)}
                >
                  <Ionicons
                    name={(LABEL_ICONS[opt] ?? "location-outline") as any}
                    size={14}
                    color={addrLabel === opt ? "#fff" : colors.text}
                  />
                  <Text
                    style={[styles.labelChipText, addrLabel === opt && styles.labelChipTextActive]}
                  >
                    {opt}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Address</Text>
            <TextInput
              style={[styles.input, { minHeight: 80, textAlignVertical: "top" }]}
              value={addrText}
              onChangeText={setAddrText}
              placeholder="Enter full address..."
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={3}
            />

            <TouchableOpacity
              style={styles.defaultToggle}
              onPress={() => setAddrDefault(!addrDefault)}
            >
              <Ionicons
                name={addrDefault ? "checkbox" : "square-outline"}
                size={20}
                color={addrDefault ? colors.primary : "#94a3b8"}
              />
              <Text style={styles.defaultToggleText}>Set as default address</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveBtn, savingAddress && { opacity: 0.6 }]}
              onPress={handleSaveAddress}
              disabled={savingAddress}
            >
              {savingAddress ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.saveBtnText}>
                  {editingAddress ? "Update Address" : "Save Address"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8faf9" },
  scrollContent: { paddingBottom: 8 },

  // Auth screen
  authContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f8faf9", padding: 24 },
  authCard: { alignItems: "center", backgroundColor: "#fff", borderRadius: 16, padding: 32, width: "100%", borderWidth: 1, borderColor: "#f1f5f9" },
  authIconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primary + "10", justifyContent: "center", alignItems: "center", marginBottom: 16 },
  authTitle: { fontSize: 20, fontWeight: "700", color: colors.text, marginBottom: 8 },
  authSubtitle: { fontSize: 14, color: "#64748b", textAlign: "center", marginBottom: 24 },
  authBtn: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 14, width: "100%", alignItems: "center", marginBottom: 10 },
  authBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  authSecondaryBtn: { borderWidth: 1, borderColor: colors.primary, borderRadius: 10, paddingVertical: 14, width: "100%", alignItems: "center" },
  authSecondaryBtnText: { color: colors.primary, fontSize: 15, fontWeight: "600" },

  // Profile header
  profileHeader: { alignItems: "center", paddingVertical: 28, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primary, justifyContent: "center", alignItems: "center", marginBottom: 12 },
  avatarText: { fontSize: 24, fontWeight: "700", color: "#fff" },
  profileName: { fontSize: 20, fontWeight: "700", color: colors.text },
  profileDetail: { fontSize: 14, color: "#64748b", marginTop: 2 },
  editProfileBtn: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 12, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, backgroundColor: colors.primary + "10" },
  editProfileBtnText: { fontSize: 13, fontWeight: "600", color: colors.primary },

  // Section
  section: { marginTop: 16, paddingHorizontal: 16 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.text },

  // Address card
  addressCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: "#f1f5f9" },
  addressIconWrap: { width: 38, height: 38, borderRadius: 10, backgroundColor: colors.primary + "10", justifyContent: "center", alignItems: "center" },
  addressInfo: { flex: 1, marginLeft: 12 },
  addressLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  addressLabel: { fontSize: 14, fontWeight: "700", color: colors.text },
  defaultBadge: { backgroundColor: colors.primary + "15", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 },
  defaultBadgeText: { fontSize: 10, fontWeight: "600", color: colors.primary },
  addressText: { fontSize: 13, color: "#64748b", marginTop: 2, lineHeight: 18 },
  addressActions: { flexDirection: "row", gap: 4 },
  addressActionBtn: { width: 32, height: 32, borderRadius: 8, justifyContent: "center", alignItems: "center" },

  // Empty addresses
  emptyAddresses: { alignItems: "center", paddingVertical: 28, backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#f1f5f9" },
  emptyText: { fontSize: 14, color: "#94a3b8", marginTop: 8, marginBottom: 12 },
  addAddressBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  addAddressBtnText: { fontSize: 13, fontWeight: "600", color: "#fff" },

  // Sign out
  signOutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 24, marginHorizontal: 16, paddingVertical: 14, backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#fee2e2" },
  signOutBtnText: { fontSize: 15, fontWeight: "600", color: "#ef4444" },

  // Modal
  modalContainer: { flex: 1, backgroundColor: "#f8faf9" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingTop: 20, paddingBottom: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  modalTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
  modalCloseBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#f1f5f9", justifyContent: "center", alignItems: "center" },
  modalBody: { padding: 16 },

  // Form
  inputLabel: { fontSize: 13, fontWeight: "600", color: "#64748b", marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: "#e2e8f0", padding: 12, fontSize: 15, color: colors.text },

  // Label picker
  labelPicker: { flexDirection: "row", gap: 8 },
  labelChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: "#e2e8f0", backgroundColor: "#fff" },
  labelChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  labelChipText: { fontSize: 13, fontWeight: "600", color: colors.text },
  labelChipTextActive: { color: "#fff" },

  // Default toggle
  defaultToggle: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16, paddingVertical: 4 },
  defaultToggleText: { fontSize: 14, color: colors.text },

  // Save button
  saveBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 24 },
  saveBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
});
