import { useCallback } from "react";
import { View, Text, TouchableOpacity, Linking, StyleSheet } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { can } from "@martly/shared/permissions";
import { useAuth } from "../../../lib/auth-context";
import { useResource } from "../../../lib/manage/use-resource";
import { ManageStackScreen } from "../ManageStackScreen";
import { HeaderAction } from "../HeaderAction";
import { SectionCard } from "../ui/SectionCard";
import { ListRow } from "../ui/ListRow";
import { StatusPill } from "../ui/StatusPill";
import { manage } from "../ui/tokens";
import { formatDate } from "../ui/dates";
import { fonts, radius } from "../../../constants/theme";
import { ROLE_PILL } from "./constants";
import { MemberResponsibilities, type MemberAccess } from "./MemberResponsibilities";
import type { UserDetail } from "./types";

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";

function ContactLine({ icon, value, onPress }: { icon: keyof typeof Ionicons.glyphMap; value: string; onPress?: () => void }) {
  return (
    <TouchableOpacity style={styles.contact} onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? "link" : undefined}>
      <Ionicons name={icon} size={15} color={manage.inkMuted} />
      <Text style={styles.contactText} numberOfLines={1}>{value}</Text>
    </TouchableOpacity>
  );
}

/** Dark identity card: who they are, their role and how much they can do at a glance */
function MemberHero({ member, access }: { member: UserDetail; access: MemberAccess | null }) {
  const pill = ROLE_PILL[member.role] ?? ROLE_PILL.STAFF;
  const stats = [
    `${member.userStores.length} store${member.userStores.length === 1 ? "" : "s"}`,
    access ? `${access.permissions.length} responsibilities` : null,
    `Joined ${formatDate(member.createdAt)}`,
  ].filter(Boolean);
  return (
    <View style={styles.hero}>
      <View style={styles.heroTop}>
        <View style={[styles.avatar, { backgroundColor: pill.bg }]}>
          <Text style={[styles.avatarText, { color: pill.color }]}>{initials(member.name)}</Text>
        </View>
        <View style={styles.heroName}>
          <Text style={styles.name} numberOfLines={2}>{member.name}</Text>
          <StatusPill {...pill} />
        </View>
      </View>
      <ContactLine icon="mail-outline" value={member.email} onPress={() => Linking.openURL(`mailto:${member.email}`)} />
      {member.phone ? <ContactLine icon="call-outline" value={member.phone} onPress={() => Linking.openURL(`tel:${member.phone}`)} /> : null}
      <Text style={styles.stats}>{stats.join("  ·  ")}</Text>
    </View>
  );
}

export function MemberDetailScreen({ id }: { id: string }) {
  const router = useRouter();
  const { user: me } = useAuth();
  const member = useResource<UserDetail>(`/api/v1/users/${id}`);
  // A super admin has no organization to hold add-ons in, so responsibilities only load for org members
  const access = useResource<MemberAccess>(me?.role === "SUPER_ADMIN" ? null : `/api/v1/users/${id}/permissions`);
  const { reload: reloadMember } = member;
  const { reload: reloadAccess } = access;

  // Coming back from Edit shows the saved changes
  useFocusEffect(useCallback(() => { reloadMember(); reloadAccess(); }, [reloadMember, reloadAccess]));

  const data = member.data;
  const canEdit = can(me, "users", "edit") && data?.role !== "SUPER_ADMIN" && (me?.role === "SUPER_ADMIN" || data?.role !== "ORG_ADMIN");

  return (
    <ManageStackScreen
      title={data?.name ?? "Team member"}
      loading={member.loading}
      error={member.error}
      onRetry={member.reload}
      headerRight={canEdit ? () => <HeaderAction icon="create-outline" onPress={() => router.push(`/manage/users/${id}/edit`)} accessibilityLabel="Edit team member" /> : undefined}
    >
      {data && (
        <>
          <MemberHero member={data} access={access.data} />
          <SectionCard title="Stores" flush>
            {data.userStores.length === 0
              ? <ListRow icon="storefront-outline" title="No stores assigned" subtitle="Assign a store so they can work in it." />
              : data.userStores.map(({ store }) => <ListRow key={store.id} icon="storefront-outline" title={store.name} />)}
          </SectionCard>
          <MemberResponsibilities role={data.role} access={access.data} />
        </>
      )}
    </ManageStackScreen>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: manage.ink, borderRadius: radius.lg, padding: 18, gap: 8, marginBottom: 12 },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 6 },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: fonts.bold, fontSize: 20 },
  heroName: { flex: 1, gap: 6, alignItems: "flex-start" },
  name: { fontFamily: fonts.bold, fontSize: 20, color: manage.inkText },
  contact: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 28 },
  contactText: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: manage.inkText },
  stats: { fontFamily: fonts.semibold, fontSize: 12.5, color: manage.inkMuted, marginTop: 6, letterSpacing: 0.2 },
});

