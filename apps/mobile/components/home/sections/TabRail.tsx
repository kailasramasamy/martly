import { memo } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { TabRailStyle } from "@martly/shared/constants";
import type { HomeTab } from "@martly/shared/types";
import { colors, fonts } from "../../../constants/theme";
import { useLanguage } from "../../../lib/language-context";

const TAB_WIDTH = 84;
const TILE = 56;
const CIRCLE = 52;
const LABEL_LINE = 14;

interface TabProps {
  label: string;
  imageUrl: string | null;
  selected: boolean;
  tint: string;
  onPress: () => void;
}

function Tab({ look, ...props }: TabProps & { look: TabRailStyle }) {
  const { label, imageUrl, selected, tint, onPress } = props;
  const a11y = { accessibilityRole: "tab", accessibilityState: { selected }, accessibilityLabel: label } as const;

  if (look === TabRailStyle.PILL) {
    return (
      <Pressable onPress={onPress} {...a11y} style={[styles.pill, selected && styles.pillOn]}>
        <Text style={[styles.pillText, selected && styles.pillTextOn]} numberOfLines={1}>{label}</Text>
      </Pressable>
    );
  }
  const art = imageUrl ? <Image source={{ uri: imageUrl }} style={styles.art} resizeMode="contain" /> : null;
  if (look === TabRailStyle.ICON_CARD) {
    // The picked tab takes the panel's colour and runs into it, so tab and products read as one piece
    return (
      <Pressable onPress={onPress} {...a11y} style={[styles.folder, selected && { backgroundColor: tint }]}>
        <View style={[styles.tile, selected && styles.tileOn]}>{art}</View>
        <Text style={[styles.label, styles.folderLabel, selected && styles.labelOn]} numberOfLines={2}>{label}</Text>
      </Pressable>
    );
  }
  return (
    <Pressable onPress={onPress} {...a11y} style={styles.underline}>
      <View style={[styles.circle, selected && styles.circleOn]}>{art}</View>
      <Text style={[styles.label, selected && styles.labelOn]} numberOfLines={1}>{label}</Text>
      <View style={[styles.bar, selected && styles.barOn]} />
    </Pressable>
  );
}

interface Props {
  tabs: HomeTab[];
  look: TabRailStyle;
  /** The panel colour below the rail */
  tint: string;
  selectedId: string;
  onSelect: (tab: HomeTab) => void;
}

/** The tab rail of a tabbed row, in one of three looks: folder tabs with icons, icons over an underline, or text pills */
export const TabRail = memo(function TabRail({ tabs, look, tint, selectedId, onSelect }: Props) {
  const { language } = useLanguage();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.rail, look === TabRailStyle.ICON_CARD ? styles.folderRail : styles.innerRail]}
      accessibilityRole="tablist"
    >
      {tabs.map((tab) => (
        <Tab
          key={tab.id}
          look={look}
          label={(language && tab.translations?.[language]?.label) || tab.label}
          imageUrl={tab.imageUrl}
          selected={tab.id === selectedId}
          tint={tint}
          onPress={() => onSelect(tab)}
        />
      ))}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  rail: { paddingHorizontal: 16 },
  // Folder tabs sit flush on the panel's top edge
  folderRail: { gap: 4, alignItems: "flex-end" },
  innerRail: { gap: 10, paddingBottom: 14, alignItems: "flex-start" },
  art: { width: "100%", height: "100%" },
  label: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: LABEL_LINE, color: colors.textSecondary, textAlign: "center" },
  // Always two lines tall, so one- and two-line tabs stand level
  folderLabel: { height: LABEL_LINE * 2 },
  labelOn: { fontFamily: fonts.extrabold, color: colors.text },
  folder: {
    width: TAB_WIDTH, alignItems: "center", gap: 6, paddingTop: 10, paddingBottom: 10, paddingHorizontal: 4,
    borderTopLeftRadius: 14, borderTopRightRadius: 14,
  },
  tile: {
    width: TILE, height: TILE, borderRadius: 14, padding: 6, overflow: "hidden",
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  tileOn: {
    borderColor: colors.surface,
    shadowColor: "#0f172a", shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  underline: { width: TAB_WIDTH, alignItems: "center", gap: 6 },
  circle: {
    width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2, padding: 8, overflow: "hidden",
    backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.surface,
  },
  circleOn: { borderColor: colors.primary },
  bar: { alignSelf: "stretch", height: 3, borderRadius: 2, backgroundColor: "transparent" },
  barOn: { backgroundColor: colors.primary },
  pill: {
    minHeight: 44, justifyContent: "center", paddingHorizontal: 16, borderRadius: 22,
    borderWidth: 1, borderColor: colors.surface, backgroundColor: colors.surface,
  },
  pillOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: { fontFamily: fonts.bold, fontSize: 13, color: colors.text },
  pillTextOn: { color: "#fff" },
});
