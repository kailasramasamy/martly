import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Permission } from "@martly/shared/constants";
import { PERMISSION_GROUPS, PERMISSION_META, ROLE_ADDONS, ROLE_PERMISSIONS } from "@martly/shared/permissions";
import { SectionCard } from "../ui/SectionCard";
import { manage } from "../ui/tokens";
import { colors, fonts } from "../../../constants/theme";

export interface MemberAccess {
  role: string;
  addOns: Permission[];
  permissions: Permission[];
  grantable: Permission[];
}

type Source = "role" | "added";

const TAG: Record<Source, { label: string; color: string; bg: string }> = {
  role: { label: "Role", color: colors.textSecondary, bg: manage.hairline },
  added: { label: "Added", color: colors.primary, bg: manage.tint },
};

function Row({ permission, source }: { permission: Permission; source: Source }) {
  const meta = PERMISSION_META[permission];
  return (
    <View style={styles.row}>
      <Ionicons name="checkmark" size={18} color={colors.primary} style={styles.tick} />
      <View style={styles.text}>
        <Text style={styles.label}>{meta.label}</Text>
        <Text style={styles.description}>{meta.description}</Text>
      </View>
      <Text style={[styles.tag, { color: TAG[source].color, backgroundColor: TAG[source].bg }]}>{TAG[source].label}</Text>
    </View>
  );
}

/** Responsibilities of a group, in catalogue order */
const inGroup = (group: string, perms: readonly Permission[]) =>
  (Object.keys(PERMISSION_META) as Permission[]).filter((p) => PERMISSION_META[p].group === group && perms.includes(p));

/** Read-only summary: what the member can do (from their role or added by the owner), then what they don't have */
export function MemberResponsibilities({ role, access }: { role: string; access: MemberAccess | null }) {
  if (role === "ORG_ADMIN" || role === "SUPER_ADMIN") {
    return <SectionCard title="Can do"><Text style={styles.note}>Owners can do everything in their organization.</Text></SectionCard>;
  }
  const included = ROLE_PERMISSIONS[role] ?? [];
  const added = (access?.addOns ?? []).filter((p) => (ROLE_ADDONS[role] ?? []).includes(p));
  const missing = (ROLE_ADDONS[role] ?? []).filter((p) => !added.includes(p));

  return (
    <>
      <SectionCard title="Can do">
        {PERMISSION_GROUPS.map((group) => {
          const perms = inGroup(group, [...included, ...added]);
          if (perms.length === 0) return null;
          return (
            <View key={group} style={styles.group}>
              <Text style={styles.groupTitle}>{group}</Text>
              {perms.map((p) => <Row key={p} permission={p} source={included.includes(p) ? "role" : "added"} />)}
            </View>
          );
        })}
      </SectionCard>
      {missing.length > 0 && (
        <SectionCard title="Not assigned">
          {PERMISSION_GROUPS.map((group) => {
            const perms = inGroup(group, missing);
            if (perms.length === 0) return null;
            return (
              <Text key={group} style={styles.missing}>
                <Text style={styles.missingGroup}>{group}: </Text>
                {perms.map((p) => PERMISSION_META[p].label).join(", ")}
              </Text>
            );
          })}
          <Text style={styles.hint}>Use Edit to assign any of these.</Text>
        </SectionCard>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  group: { marginBottom: 10 },
  groupTitle: { fontFamily: fonts.bold, fontSize: 12, color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48, paddingVertical: 6 },
  tick: { width: 18 },
  text: { flex: 1 },
  label: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  description: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary, marginTop: 1 },
  tag: { fontFamily: fonts.bold, fontSize: 11, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, overflow: "hidden" },
  missing: { fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 20, color: colors.textSecondary, marginBottom: 8 },
  missingGroup: { fontFamily: fonts.semibold, color: colors.text },
  hint: { fontFamily: fonts.medium, fontSize: 12.5, color: manage.muted, marginTop: 4 },
  note: { fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary },
});
