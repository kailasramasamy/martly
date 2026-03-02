import { View, Text, Pressable, StyleSheet, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../lib/auth-context";
import { colors, spacing, fontSize, borderRadius, fonts } from "../../constants/theme";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();

  function handleLogout() {
    Alert.alert("Logout", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: () => logout() },
    ]);
  }

  const initials = (user?.name ?? "R")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      {/* Avatar Card */}
      <View style={styles.profileCard}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.onlineDot} />
        </View>
        <Text style={styles.userName}>{user?.name ?? "Rider"}</Text>
        {user?.phone && (
          <Text style={styles.userPhone}>+91 {user.phone}</Text>
        )}
        {user?.email && (
          <Text style={styles.userEmail}>{user.email}</Text>
        )}
        <View style={styles.roleBadge}>
          <Ionicons name="shield-checkmark" size={12} color={colors.primary} />
          <Text style={styles.roleText}>Delivery Partner</Text>
        </View>
      </View>

      {/* Info Items */}
      <View style={styles.section}>
        <View style={styles.infoRow}>
          <View style={styles.infoIconBg}>
            <Ionicons name="person-outline" size={18} color={colors.primary} />
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Full Name</Text>
            <Text style={styles.infoValue}>{user?.name ?? "-"}</Text>
          </View>
        </View>

        <View style={styles.infoDivider} />

        <View style={styles.infoRow}>
          <View style={styles.infoIconBg}>
            <Ionicons name="call-outline" size={18} color={colors.primary} />
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Phone</Text>
            <Text style={styles.infoValue}>{user?.phone ? `+91 ${user.phone}` : "-"}</Text>
          </View>
        </View>

        <View style={styles.infoDivider} />

        <View style={styles.infoRow}>
          <View style={styles.infoIconBg}>
            <Ionicons name="mail-outline" size={18} color={colors.primary} />
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{user?.email ?? "-"}</Text>
          </View>
        </View>

        <View style={styles.infoDivider} />

        <View style={styles.infoRow}>
          <View style={styles.infoIconBg}>
            <Ionicons name="briefcase-outline" size={18} color={colors.primary} />
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Role</Text>
            <Text style={styles.infoValue}>{user?.role ?? "-"}</Text>
          </View>
        </View>
      </View>

      {/* Logout */}
      <Pressable style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color={colors.error} />
        <Text style={styles.logoutText}>Sign Out</Text>
      </Pressable>

      {/* App Version */}
      <Text style={styles.version}>Martly Rider v1.0.0</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerTitle: {
    fontSize: fontSize.heading,
    fontFamily: fonts.bold,
    color: colors.text,
  },

  // Profile Card
  profileCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarContainer: {
    position: "relative",
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: fontSize.heading,
    fontFamily: fonts.bold,
    color: "#fff",
  },
  onlineDot: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.success,
    borderWidth: 3,
    borderColor: colors.surface,
  },
  userName: {
    fontSize: fontSize.title,
    fontFamily: fonts.bold,
    color: colors.text,
  },
  userPhone: {
    fontSize: fontSize.body,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginTop: 2,
  },
  userEmail: {
    fontSize: fontSize.sm,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginTop: 2,
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: spacing.sm,
    backgroundColor: "#fff7ed",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: borderRadius.pill,
  },
  roleText: {
    fontSize: fontSize.sm,
    fontFamily: fonts.semibold,
    color: colors.primary,
  },

  // Info Section
  section: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  infoIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#fff7ed",
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.sm,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: fontSize.caption,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
  },
  infoValue: {
    fontSize: fontSize.body,
    fontFamily: fonts.semibold,
    color: colors.text,
    marginTop: 1,
  },
  infoDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 44,
  },

  // Logout
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: "#fef2f2",
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  logoutText: {
    fontSize: fontSize.body,
    fontFamily: fonts.semibold,
    color: colors.error,
  },

  // Version
  version: {
    textAlign: "center",
    fontSize: fontSize.caption,
    fontFamily: fonts.regular,
    color: "#94a3b8",
    marginTop: spacing.lg,
  },
});
