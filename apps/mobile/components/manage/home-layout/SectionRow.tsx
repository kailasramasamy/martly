import { View, Text, TouchableOpacity, Switch, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { HomeSectionTypeLabels, type HomeSectionType } from "@martly/shared/constants";
import { colors, fonts, radius } from "../../../constants/theme";
import { manage, tabular } from "../ui/tokens";
import { StatusPill } from "../ui/StatusPill";
import type { HomeSectionRecord } from "./types";

interface SectionRowProps {
  section: HomeSectionRecord;
  index: number;
  count: number;
  /** Store the section does not resolve at, when it doesn't */
  hiddenAt?: string;
  locked: boolean;
  onOpen: () => void;
  onToggle: (isActive: boolean) => void;
  onMove: (to: number) => void;
  onDelete: () => void;
}

interface StepProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  disabled: boolean;
  onPress: () => void;
  danger?: boolean;
}

function IconStep({ icon, label, disabled, onPress, danger }: StepProps) {
  return (
    <TouchableOpacity style={[styles.step, disabled && styles.stepOff]} onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} activeOpacity={0.6}>
      <Ionicons name={icon} size={20} color={danger ? colors.error : colors.text} />
    </TouchableOpacity>
  );
}

export function SectionRow({ section, index, count, hiddenAt, locked, onOpen, onToggle, onMove, onDelete }: SectionRowProps) {
  const typeLabel = HomeSectionTypeLabels[section.type as HomeSectionType] ?? section.type;
  return (
    <View style={[styles.card, !section.isActive && styles.inactive]}>
      <TouchableOpacity style={styles.main} onPress={onOpen} disabled={locked} activeOpacity={0.7}>
        <Text style={[styles.index, tabular]}>{String(index + 1).padStart(2, "0")}</Text>
        <View style={styles.body}>
          <Text style={styles.type}>{typeLabel}</Text>
          <Text style={styles.title} numberOfLines={2}>{section.title || typeLabel}</Text>
          {hiddenAt ? (
            <View style={styles.badge}><StatusPill label={`Hidden at ${hiddenAt}`} color={manage.attentionText} bg={manage.attentionBg} /></View>
          ) : null}
        </View>
        <Switch
          value={section.isActive}
          onValueChange={onToggle}
          disabled={locked}
          trackColor={{ true: colors.primary, false: manage.line }}
          accessibilityLabel={`${typeLabel} active`}
        />
      </TouchableOpacity>
      <View style={styles.actions}>
        <IconStep icon="arrow-up" label="Move up" disabled={locked || index === 0} onPress={() => onMove(index - 1)} />
        <IconStep icon="arrow-down" label="Move down" disabled={locked || index === count - 1} onPress={() => onMove(index + 1)} />
        <View style={styles.spacer} />
        <IconStep icon="trash-outline" label="Delete section" disabled={locked} onPress={onDelete} danger />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: manage.card, borderRadius: radius.lg, borderWidth: 1, borderColor: manage.line, marginHorizontal: 12, marginTop: 10, overflow: "hidden" },
  inactive: { opacity: 0.6 },
  main: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8, minHeight: 64 },
  index: { fontFamily: fonts.extrabold, fontSize: 20, color: manage.line, width: 30 },
  body: { flex: 1, minWidth: 0 },
  type: { fontFamily: fonts.bold, fontSize: 11, color: colors.primary, letterSpacing: 0.9, textTransform: "uppercase" },
  title: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 20, color: colors.text, marginTop: 2 },
  badge: { marginTop: 6 },
  actions: { flexDirection: "row", alignItems: "center", paddingHorizontal: 6, borderTopWidth: 1, borderTopColor: manage.hairline },
  step: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  stepOff: { opacity: 0.3 },
  spacer: { flex: 1 },
});
