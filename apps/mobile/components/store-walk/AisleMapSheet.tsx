import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { StoreWalkStop } from "@martly/shared/types";
import { colors, fonts } from "../../constants/theme";
import { useLanguage } from "../../lib/language-context";
import { useStrings } from "../../lib/i18n/use-strings";

interface Props {
  visible: boolean;
  stops: StoreWalkStop[];
  index: number;
  /** Aisles walked past, by category */
  walked: Set<string>;
  onJump: (index: number) => void;
  onFinish: () => void;
  onClose: () => void;
}

function Dot({ state }: { state: "walked" | "here" | "ahead" }) {
  if (state === "walked") return <View style={[styles.dot, styles.dotWalked]}><Ionicons name="checkmark" size={14} color="#ffffff" /></View>;
  return <View style={[styles.dot, state === "here" ? styles.dotHere : styles.dotAhead]} />;
}

/** The department's aisles with where the shopper has been: walked, here, ahead. Tap one to go there. */
export function AisleMapSheet({ visible, stops, index, walked, onJump, onFinish, onClose }: Props) {
  const t = useStrings("storeWalk");
  const { getLocalizedName } = useLanguage();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel={t.closeMap} />
      <View style={[styles.sheet, { paddingBottom: Math.max(20, insets.bottom + 8) }]}>
        <View style={styles.handle} />
        <Text style={styles.title}>{t.mapTitle}</Text>
        <Text style={styles.subtitle}>{t.mapSubtitle(walked.size, stops.length)}</Text>
        <ScrollView style={styles.list}>
          {stops.map((stop, i) => {
            const past = walked.has(stop.categoryId);
            const here = i === index;
            return (
              <TouchableOpacity
                key={stop.categoryId} style={styles.row} accessibilityRole="button"
                onPress={() => { onJump(i); onClose(); }}
              >
                <Dot state={here ? "here" : past ? "walked" : "ahead"} />
                <Text style={styles.name} numberOfLines={1}>{getLocalizedName(stop)}</Text>
                {here && <View style={styles.here}><Text style={styles.hereText}>{t.youAreHere}</Text></View>}
                {!here && !past && stop.dueCount > 0 && <View style={styles.due}><Text style={styles.dueText}>{t.dueBadge(stop.dueCount)}</Text></View>}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <TouchableOpacity style={styles.finish} onPress={() => { onClose(); onFinish(); }} accessibilityRole="button">
          <Text style={styles.finishText}>{t.finishNow}</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)" },
  sheet: { maxHeight: "78%", backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 10, paddingHorizontal: 16 },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "#cbd5e1", marginBottom: 12 },
  title: { fontFamily: fonts.extrabold, fontSize: 20, color: colors.text },
  subtitle: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textSecondary, marginTop: 2, marginBottom: 8 },
  list: { flexGrow: 0 },
  row: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  dot: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  dotWalked: { backgroundColor: colors.primary },
  dotHere: { borderWidth: 3, borderColor: colors.primaryLight },
  dotAhead: { borderWidth: 2, borderColor: "#cbd5e1" },
  name: { flex: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  here: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: "#ccfbf1" },
  hereText: { fontFamily: fonts.extrabold, fontSize: 11, color: colors.primaryDark },
  due: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: "#fef3c7" },
  dueText: { fontFamily: fonts.extrabold, fontSize: 11, color: "#78350f" },
  finish: { height: 50, marginTop: 12, borderRadius: 12, borderWidth: 1.5, borderColor: colors.primary, alignItems: "center", justifyContent: "center" },
  finishText: { fontFamily: fonts.extrabold, fontSize: 15, color: colors.primary },
});
