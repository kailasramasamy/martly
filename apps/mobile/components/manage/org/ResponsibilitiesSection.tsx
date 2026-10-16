import { Text, View, StyleSheet } from "react-native";
import type { Permission } from "@martly/shared/constants";
import { PERMISSION_GROUPS, PERMISSION_META, ROLE_ADDONS, ROLE_PERMISSIONS } from "@martly/shared/permissions";
import { SectionCard } from "../ui/SectionCard";
import { SwitchRow } from "../ui/SwitchRow";
import { colors, fonts } from "../../../constants/theme";

interface ResponsibilitiesSectionProps {
  role: string;
  value: string[];
  onChange: (next: string[]) => void;
}

/** What the member's role includes, plus the extra responsibilities an owner can switch on */
export function ResponsibilitiesSection({ role, value, onChange }: ResponsibilitiesSectionProps) {
  const included = ROLE_PERMISSIONS[role] ?? [];
  const grantable = ROLE_ADDONS[role] ?? [];
  if (!role || role === "ORG_ADMIN" || role === "SUPER_ADMIN") return null;

  return (
    <SectionCard title="Responsibilities">
      {PERMISSION_GROUPS.map((group) => {
        const perms = (Object.keys(PERMISSION_META) as Permission[])
          .filter((p) => PERMISSION_META[p].group === group && (included.includes(p) || grantable.includes(p)));
        if (perms.length === 0) return null;
        return (
          <View key={group} style={styles.group}>
            <Text style={styles.groupTitle}>{group}</Text>
            {perms.map((p) => {
              const isIncluded = included.includes(p);
              return (
                <SwitchRow
                  key={p}
                  label={PERMISSION_META[p].label}
                  description={isIncluded ? `Included with this role · ${PERMISSION_META[p].description}` : PERMISSION_META[p].description}
                  value={isIncluded || value.includes(p)}
                  disabled={isIncluded}
                  onValueChange={(on) => onChange(on ? [...value, p] : value.filter((v) => v !== p))}
                />
              );
            })}
          </View>
        );
      })}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  group: { marginBottom: 8 },
  groupTitle: { fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 },
});
