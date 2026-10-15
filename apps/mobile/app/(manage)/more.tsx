import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../lib/auth-context";
import { usePersona } from "../../lib/persona-context";
import { useManageScope } from "../../lib/manage-scope-context";
import { colors, fonts, radius } from "../../constants/theme";
import { ManageScreen } from "../../components/manage/ManageScreen";
import { MenuGroup, type MenuItem } from "../../components/account/MenuGroup";
import { modulesFor } from "../../components/manage/modules";
import { manage } from "../../components/manage/ui/tokens";

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Platform admin",
  ORG_ADMIN: "Owner",
  STORE_MANAGER: "Store manager",
};

const APP_VERSION = `Version ${Constants.expoConfig?.version}`;

function IdentityCard() {
  const { user } = useAuth();
  const { store, stores } = useManageScope();
  const org = user?.organizations.find((o) => o.id === user.organizationId)?.name ?? store?.organizationName;
  return (
    <View style={styles.identity}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{(user?.name || user?.email || "?").slice(0, 1).toUpperCase()}</Text>
      </View>
      <View style={styles.identityText}>
        <Text style={styles.name} numberOfLines={1}>{user?.name || user?.email}</Text>
        <Text style={styles.meta} numberOfLines={1}>
          {ROLE_LABELS[user?.role ?? ""] ?? user?.role}{org ? ` · ${org}` : ""} · {stores.length} {stores.length === 1 ? "store" : "stores"}
        </Text>
      </View>
    </View>
  );
}

export default function ManageMoreScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { switchPersona } = usePersona();
  const groups = modulesFor(user?.role ?? "");

  const toItems = (modules: ReturnType<typeof modulesFor>[number]["modules"]): MenuItem[] =>
    modules.map((m) => ({ icon: m.icon, label: m.label, onPress: () => router.push(m.href) }));

  return (
    <ManageScreen title="More">
      <IdentityCard />
      <TouchableOpacity style={styles.switch} onPress={() => switchPersona("shop")} activeOpacity={0.85}>
        <View style={styles.switchIcon}>
          <Ionicons name="bag-handle-outline" size={20} color={manage.attentionText} />
        </View>
        <View style={styles.identityText}>
          <Text style={styles.switchTitle}>Switch to shopping</Text>
          <Text style={styles.switchSub}>Browse and order as a customer</Text>
        </View>
        <Ionicons name="swap-horizontal" size={18} color={manage.attentionText} />
      </TouchableOpacity>
      {groups.map((g) => <MenuGroup key={g.title} title={g.title} items={toItems(g.modules)} />)}
      <TouchableOpacity style={styles.signOut} onPress={logout} activeOpacity={0.8}>
        <Ionicons name="log-out-outline" size={18} color={colors.error} />
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>
      <Text style={styles.version}>{APP_VERSION}</Text>
    </ManageScreen>
  );
}

const styles = StyleSheet.create({
  identity: {
    flexDirection: "row", alignItems: "center", gap: 12, padding: 14,
    backgroundColor: manage.card, borderRadius: radius.lg, borderWidth: 1, borderColor: manage.line,
  },
  avatar: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: fonts.extrabold, fontSize: 18, color: "#fff" },
  identityText: { flex: 1 },
  name: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  meta: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary, marginTop: 2 },
  switch: {
    flexDirection: "row", alignItems: "center", gap: 12, padding: 14, minHeight: 64,
    backgroundColor: manage.attentionBg, borderRadius: radius.lg,
  },
  switchIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: "#fde68a", alignItems: "center", justifyContent: "center" },
  switchTitle: { fontFamily: fonts.bold, fontSize: 15, color: manage.attentionText },
  switchSub: { fontFamily: fonts.medium, fontSize: 12.5, color: "#a16207", marginTop: 1 },
  signOut: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    marginTop: 14, height: 52, borderRadius: 14, backgroundColor: "#fff", borderWidth: 1, borderColor: "#fecaca",
  },
  signOutText: { fontFamily: fonts.bold, fontSize: 15, color: colors.error },
  version: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, textAlign: "center" },
});
