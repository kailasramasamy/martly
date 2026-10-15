import type { ReactNode } from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius } from "../../../constants/theme";
import { manage, tabular } from "./tokens";

interface ListRowProps {
  title: string;
  subtitle?: string;
  /** Third line, e.g. timestamps */
  caption?: string;
  /** Right-aligned primary figure, e.g. an amount */
  value?: string;
  /** Right-aligned node under the value, e.g. a StatusPill */
  trailing?: ReactNode;
  icon?: keyof typeof Ionicons.glyphMap;
  imageUrl?: string | null;
  /** Coloured left rail that encodes status at a glance */
  railColor?: string;
  /** Status shown in its own colours: tints the icon tile and leads the caption line */
  status?: { label: string; color: string; bg: string };
  onPress?: () => void;
  onLongPress?: () => void;
  selected?: boolean;
  chevron?: boolean;
}

function Leading({ icon, imageUrl, status }: Pick<ListRowProps, "icon" | "imageUrl" | "status">) {
  if (imageUrl !== undefined) {
    return imageUrl
      ? <Image source={{ uri: imageUrl }} style={styles.thumb} />
      : <View style={[styles.thumb, styles.thumbEmpty]}><Ionicons name="image-outline" size={18} color={manage.muted} /></View>;
  }
  if (!icon) return null;
  return (
    <View style={[styles.iconWrap, status && { backgroundColor: status.bg }]}>
      <Ionicons name={icon} size={18} color={status?.color ?? colors.primary} />
    </View>
  );
}

export function ListRow(props: ListRowProps) {
  const { title, subtitle, caption, value, trailing, railColor, status, onPress, onLongPress, selected, chevron } = props;
  return (
    <TouchableOpacity
      style={[styles.row, railColor ? styles.railed : null, selected && styles.selected]}
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={!onPress && !onLongPress}
      activeOpacity={0.7}
    >
      {railColor && <View style={[styles.rail, { backgroundColor: railColor }]} />}
      {selected !== undefined && (
        <Ionicons name={selected ? "checkbox" : "square-outline"} size={22} color={selected ? colors.primary : manage.muted} />
      )}
      <Leading icon={props.icon} imageUrl={props.imageUrl} status={status} />
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
        {caption || status ? (
          <Text style={styles.caption} numberOfLines={1}>
            {status ? <Text style={[styles.statusLabel, { color: status.color }]}>{status.label}</Text> : null}
            {status && caption ? " \u00B7 " : null}
            {caption}
          </Text>
        ) : null}
      </View>
      {(value || trailing) && (
        <View style={styles.right}>
          {value ? <Text style={[styles.value, tabular]}>{value}</Text> : null}
          {trailing}
        </View>
      )}
      {chevron && <Ionicons name="chevron-forward" size={16} color={manage.muted} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64,
    paddingHorizontal: 14, paddingVertical: 10, backgroundColor: manage.card,
    borderBottomWidth: 1, borderBottomColor: manage.hairline,
  },
  selected: { backgroundColor: manage.tint },
  rail: { position: "absolute", left: 0, top: 0, bottom: 0, width: 5 },
  railed: { paddingLeft: 19 },
  thumb: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: manage.canvas },
  thumbEmpty: { alignItems: "center", justifyContent: "center" },
  iconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: manage.tint, alignItems: "center", justifyContent: "center" },
  body: { flex: 1, minWidth: 0 },
  title: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 20, color: colors.text },
  subtitle: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  caption: { fontFamily: fonts.medium, fontSize: 12, color: manage.muted, marginTop: 2 },
  statusLabel: { fontFamily: fonts.extrabold, fontSize: 12 },
  right: { alignItems: "flex-end", gap: 4 },
  value: { fontFamily: fonts.extrabold, fontSize: 15, color: colors.text },
});
