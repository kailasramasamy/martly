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
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { useToast } from "../../lib/toast-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../lib/auth-context";
import { useStore } from "../../lib/store-context";
import { api } from "../../lib/api";
import { colors, spacing, fontSize } from "../../constants/theme";
import { AddressAutocomplete } from "../../components/AddressAutocomplete";
import { ConfirmSheet } from "../../components/ConfirmSheet";
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
  const router = useRouter();
  const { logout, user, isAuthenticated, refreshUser } = useAuth();
  const { selectedStore } = useStore();
  const storeId = selectedStore?.id;
  const toast = useToast();

  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [isMember, setIsMember] = useState(false);

  // Edit profile state
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Address modal state
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState<UserAddress | null>(null);
  const [addrLabel, setAddrLabel] = useState<string>("Home");
  const [addrPlaceName, setAddrPlaceName] = useState<string | null>(null);
  const [addrText, setAddrText] = useState("");
  const [addrLat, setAddrLat] = useState<number | null>(null);
  const [addrLng, setAddrLng] = useState<number | null>(null);
  const [addrPincode, setAddrPincode] = useState<string | null>(null);
  const [addrDefault, setAddrDefault] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<UserAddress | null>(null);

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

  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) {
        fetchAddresses();
        api.get<{ balance: number }>("/api/v1/wallet")
          .then((res) => setWalletBalance(res.data.balance))
          .catch(() => {});
        if (storeId) {
          api.get<{ balance: { points: number } }>(`/api/v1/loyalty?storeId=${storeId}`)
            .then((res) => setLoyaltyPoints(res.data.balance.points))
            .catch(() => {});
          api.get<{ isMember: boolean }>(`/api/v1/memberships/status?storeId=${storeId}`)
            .then((res) => setIsMember(res.data.isMember))
            .catch(() => {});
        }
      }
    }, [isAuthenticated, fetchAddresses, storeId])
  );

  const handleLogout = async () => {
    await logout();
    // Stay on the profile tab — unauthenticated view will show
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
      toast.show(e instanceof Error ? e.message : "Failed to update profile", "error");
    } finally {
      setSavingProfile(false);
    }
  };

  const openAddAddress = () => {
    if (addresses.length >= MAX_ADDRESSES) {
      toast.show(`You can save up to ${MAX_ADDRESSES} addresses`, "error");
      return;
    }
    setEditingAddress(null);
    setAddrLabel("Home");
    setAddrPlaceName(null);
    setAddrText("");
    setAddrLat(null);
    setAddrLng(null);
    setAddrPincode(null);
    setAddrDefault(false);
    setShowAddressModal(true);
  };

  const openEditAddress = (addr: UserAddress) => {
    setEditingAddress(addr);
    setAddrLabel(addr.label);
    setAddrPlaceName(addr.placeName ?? null);
    setAddrText(addr.address);
    setAddrLat(addr.latitude ?? null);
    setAddrLng(addr.longitude ?? null);
    setAddrPincode(addr.pincode ?? null);
    setAddrDefault(addr.isDefault);
    setShowAddressModal(true);
  };

  const handleSaveAddress = async () => {
    if (addrText.trim().length < 5) {
      toast.show("Address must be at least 5 characters", "error");
      return;
    }
    setSavingAddress(true);
    try {
      const payload: Record<string, unknown> = {
        label: addrLabel,
        placeName: addrPlaceName ?? undefined,
        address: addrText.trim(),
        isDefault: addrDefault,
        ...(addrLat != null && addrLng != null ? { latitude: addrLat, longitude: addrLng } : {}),
        ...(addrPincode ? { pincode: addrPincode } : {}),
      };
      if (editingAddress) {
        await api.put(`/api/v1/addresses/${editingAddress.id}`, payload);
      } else {
        await api.post("/api/v1/addresses", payload);
      }
      setShowAddressModal(false);
      fetchAddresses();
    } catch (e: unknown) {
      toast.show(e instanceof Error ? e.message : "Failed to save address", "error");
    } finally {
      setSavingAddress(false);
    }
  };

  const handleDeleteAddress = (addr: UserAddress) => {
    setDeleteConfirm(addr);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    try {
      await api.delete(`/api/v1/addresses/${deleteConfirm.id}`);
      setDeleteConfirm(null);
      fetchAddresses();
    } catch {
      toast.show("Failed to delete address", "error");
    }
  };

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

        {/* Quick Links */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/wallet")}>
            <View style={[styles.menuIconWrap, { backgroundColor: colors.primary + "14" }]}>
              <Ionicons name="wallet-outline" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.menuItemLabel}>Martly Wallet</Text>
              {walletBalance > 0 && (
                <Text style={styles.menuItemSub}>Balance: {"\u20B9"}{walletBalance.toFixed(0)}</Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
          </TouchableOpacity>
          <View style={{ height: 8 }} />
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/loyalty")}>
            <View style={[styles.menuIconWrap, { backgroundColor: "#fffbeb" }]}>
              <Ionicons name="star-outline" size={18} color="#d97706" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.menuItemLabel}>Loyalty Points</Text>
              {loyaltyPoints > 0 && (
                <Text style={[styles.menuItemSub, { color: "#d97706" }]}>
                  {loyaltyPoints} points
                </Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
          </TouchableOpacity>
          <View style={{ height: 8 }} />
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/membership")}>
            <View style={[styles.menuIconWrap, { backgroundColor: "#f5f3ff" }]}>
              <Ionicons name="diamond-outline" size={18} color="#7c3aed" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.menuItemLabel}>Mart Plus</Text>
              {isMember && (
                <Text style={[styles.menuItemSub, { color: "#7c3aed" }]}>Active</Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
          </TouchableOpacity>
          <View style={{ height: 8 }} />
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/wishlist")}>
            <View style={[styles.menuIconWrap, { backgroundColor: "#fef2f2" }]}>
              <Ionicons name="heart-outline" size={18} color="#ef4444" />
            </View>
            <Text style={styles.menuItemText}>My Wishlist</Text>
            <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
          </TouchableOpacity>
          <View style={{ height: 8 }} />
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/referral")}>
            <View style={[styles.menuIconWrap, { backgroundColor: "#f0fdfa" }]}>
              <Ionicons name="people-outline" size={18} color="#0d9488" />
            </View>
            <Text style={styles.menuItemText}>Refer & Earn</Text>
            <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
          </TouchableOpacity>
          <View style={{ height: 8 }} />
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/support-tickets")}>
            <View style={[styles.menuIconWrap, { backgroundColor: "#fff7ed" }]}>
              <Ionicons name="headset-outline" size={18} color="#f59e0b" />
            </View>
            <Text style={styles.menuItemText}>My Tickets</Text>
            <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
          </TouchableOpacity>
          <View style={{ height: 8 }} />
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/smart-reorder")}>
            <View style={[styles.menuIconWrap, { backgroundColor: "#f0fdf4" }]}>
              <Ionicons name="refresh-circle-outline" size={18} color={colors.primary} />
            </View>
            <Text style={styles.menuItemText}>Smart Reorder</Text>
            <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
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
                    <Text style={styles.addressLabel}>{addr.placeName || addr.label}</Text>
                    <View style={styles.addressTypeBadge}>
                      <Text style={styles.addressTypeBadgeText}>{addr.label}</Text>
                    </View>
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

      <ConfirmSheet
        visible={deleteConfirm !== null}
        title="Delete Address"
        message={deleteConfirm ? `Remove "${deleteConfirm.label}" address?` : ""}
        icon="trash-outline"
        iconColor="#ef4444"
        confirmLabel="Delete"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteConfirm(null)}
      />

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
            <AddressAutocomplete
              placeholder="Search for your address..."
              initialValue={addrText}
              onSelect={(result) => {
                setAddrText(result.address);
                setAddrLat(result.latitude || null);
                setAddrLng(result.longitude || null);
                setAddrPincode(result.pincode ?? null);
                if (result.placeName) setAddrPlaceName(result.placeName);
              }}
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

  // Profile header
  profileHeader: { alignItems: "center", paddingVertical: 28, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primary, justifyContent: "center", alignItems: "center", marginBottom: 12 },
  avatarText: { fontSize: 24, fontWeight: "700", color: "#fff" },
  profileName: { fontSize: 20, fontWeight: "700", color: colors.text },
  profileDetail: { fontSize: 14, color: "#64748b", marginTop: 2 },
  editProfileBtn: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 12, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, backgroundColor: colors.primary + "10" },
  editProfileBtnText: { fontSize: 13, fontWeight: "600", color: colors.primary },

  // Menu items
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  menuItemText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
    marginLeft: 12,
  },
  menuItemLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  menuItemSub: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: "600",
    marginTop: 1,
  },

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
  addressTypeBadge: { backgroundColor: "#f1f5f9", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 },
  addressTypeBadgeText: { fontSize: 10, fontWeight: "600", color: "#64748b" },
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
