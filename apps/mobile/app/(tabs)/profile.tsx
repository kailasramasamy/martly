import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../lib/auth-context";
import { useStore } from "../../lib/store-context";
import { useLanguage } from "../../lib/language-context";
import { useToast } from "../../lib/toast-context";
import { useAccountSummary } from "../../lib/use-account-summary";
import { api } from "../../lib/api";
import { colors, fonts, spacing } from "../../constants/theme";
import { ConfirmSheet } from "../../components/ConfirmSheet";
import { ProfileHeader } from "../../components/account/ProfileHeader";
import { MenuGroup, type MenuItem } from "../../components/account/MenuGroup";
import { AddressList } from "../../components/account/AddressList";
import { AddressSheet } from "../../components/account/AddressSheet";
import { EditProfileSheet } from "../../components/account/EditProfileSheet";
import type { UserAddress } from "../../lib/types";

const BUILD_NUMBER = Constants.expoConfig?.ios?.buildNumber;
const APP_VERSION = `Version ${Constants.expoConfig?.version}${BUILD_NUMBER ? ` (${BUILD_NUMBER})` : ""}`;

const MAX_ADDRESSES = 5;

function useMenuGroups(subscriptionsEnabled: boolean): { title: string; items: MenuItem[] }[] {
  const router = useRouter();
  const { language, supportedLanguages } = useLanguage();
  const go = (path: Parameters<typeof router.push>[0]) => () => router.push(path);
  return [
    {
      title: "Shopping",
      items: [
        { icon: "heart-outline", label: "My Wishlist", onPress: go("/wishlist") },
        { icon: "refresh-circle-outline", label: "Smart Reorder", onPress: go("/smart-reorder") },
        ...(subscriptionsEnabled ? [{ icon: "calendar-outline" as const, label: "My Subscriptions", onPress: go("/subscriptions") }] : []),
      ],
    },
    {
      title: "Rewards",
      items: [
        { icon: "diamond-outline", label: "Mart Plus", onPress: go("/membership"), premium: true },
        { icon: "gift-outline", label: "Refer & Earn", onPress: go("/referral") },
      ],
    },
    {
      title: "Help & settings",
      items: [
        { icon: "chatbubbles-outline", label: "Chat with Support", onPress: go("/support-chat") },
        { icon: "headset-outline", label: "My Tickets", onPress: go("/support-tickets") },
        { icon: "language-outline", label: "Language", value: language ? supportedLanguages[language] : "English", onPress: go("/language-settings") },
      ],
    },
  ];
}

export default function ProfileScreen() {
  const router = useRouter();
  const { logout, user, isAuthenticated } = useAuth();
  const { selectedStore } = useStore();
  const toast = useToast();
  const summary = useAccountSummary(isAuthenticated, selectedStore?.id);
  const menuGroups = useMenuGroups(!!selectedStore?.subscriptionEnabled);
  const [editingProfile, setEditingProfile] = useState(false);
  const [addressSheet, setAddressSheet] = useState<{ address: UserAddress | null } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserAddress | null>(null);

  const openAddAddress = () => {
    if (summary.addresses.length >= MAX_ADDRESSES) {
      toast.show(`You can save up to ${MAX_ADDRESSES} addresses`, "error");
      return;
    }
    setAddressSheet({ address: null });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/api/v1/addresses/${deleteTarget.id}`);
      setDeleteTarget(null);
      summary.fetchAddresses();
    } catch {
      toast.show("Failed to delete address", "error");
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <ProfileHeader
          name={user?.name} phone={user?.phone} email={user?.email}
          walletBalance={summary.walletBalance} loyaltyPoints={summary.loyaltyPoints} isMember={summary.isMember}
          onEdit={() => setEditingProfile(true)}
        />
        {menuGroups.map((group) => <MenuGroup key={group.title} title={group.title} items={group.items} />)}
        <AddressList
          addresses={summary.addresses}
          loading={summary.loadingAddresses}
          onAdd={openAddAddress}
          onEdit={(address) => setAddressSheet({ address })}
          onDelete={setDeleteTarget}
        />
        <TouchableOpacity style={styles.signOut} onPress={logout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={18} color={colors.error} />
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteAccount} onPress={() => router.push("/delete-account")} activeOpacity={0.7}>
          <Text style={styles.deleteAccountText}>Delete account</Text>
        </TouchableOpacity>
        <Text style={styles.version}>{APP_VERSION}</Text>
      </ScrollView>

      <EditProfileSheet visible={editingProfile} onClose={() => setEditingProfile(false)} />
      <AddressSheet
        visible={addressSheet !== null}
        address={addressSheet?.address ?? null}
        onClose={() => setAddressSheet(null)}
        onSaved={summary.fetchAddresses}
      />
      <ConfirmSheet
        visible={deleteTarget !== null}
        title="Delete Address"
        message={deleteTarget ? `Remove "${deleteTarget.label}" address?` : ""}
        icon="trash-outline"
        iconColor="#ef4444"
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  scroll: { padding: spacing.md, paddingBottom: 48 },
  signOut: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    marginTop: 28, height: 52, borderRadius: 14, backgroundColor: "#fff", borderWidth: 1, borderColor: "#fecaca",
  },
  signOutText: { fontFamily: fonts.bold, fontSize: 15, color: colors.error },
  deleteAccount: { height: 44, alignItems: "center", justifyContent: "center", marginTop: 8 },
  version: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, textAlign: "center", marginTop: 4, letterSpacing: 0 },
  deleteAccountText: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.textSecondary, letterSpacing: 0 },
});
