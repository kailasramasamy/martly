import { View, Text, Modal, TouchableOpacity, Animated, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts } from "../../constants/theme";
import { useStrings } from "../../lib/i18n/use-strings";
import type { CreditGrantView } from "@martly/shared/types";
import { useCredits } from "../../lib/credits-context";
import { expiryLabel, rupees, useCreditCopy } from "../../lib/credit-copy";
import { StoreMark } from "../StoreMark";
import { Coin } from "./Coin";
import { SPARK_ANGLES, useCelebrationMotion } from "./use-celebration-motion";

type Motion = ReturnType<typeof useCelebrationMotion>;

/** Full-screen welcome when a new customer's credit lands: every grant not yet shown, together, then never again */
export function CreditCelebration() {
  const t = useStrings("credits").celebration;
  const copy = useCreditCopy();
  const insets = useSafeAreaInsets();
  const { isCustomer, grants, markSeen } = useCredits();
  const fresh = isCustomer ? grants.filter((g) => !g.announced) : [];
  const motion = useCelebrationMotion(fresh.length > 0);
  if (fresh.length === 0) return null;
  const dismiss = () => fresh.forEach((g) => markSeen(g.id));
  const total = fresh.reduce((sum, g) => sum + g.amount, 0);
  const dates = [...new Set(fresh.map((g) => expiryLabel(g.expiresAt)))];

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={dismiss}>
      <View style={[styles.backdrop, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 20 }]} accessibilityViewIsModal>
        <View style={styles.body}>
          <WalletDrop motion={motion} />
          <Animated.View style={[styles.words, motion.words]}>
            <Text style={styles.eyebrow}>{t.eyebrow}</Text>
            <Text style={styles.amount}>₹{rupees(total)}</Text>
            <Text style={styles.subtitle}>{fresh.length === 1 ? t.freeName(copy.name(fresh[0])) : t.free}</Text>
            <View style={styles.lines}>
              {fresh.map((g) => <CreditLine key={g.id} grant={g} showDate={dates.length > 1} />)}
            </View>
            {dates.length === 1 && (
              <View style={styles.chip}>
                <Ionicons name="time-outline" size={14} color={colors.accent} />
                <Text style={styles.chipText}>{t.validTill(dates[0])}</Text>
              </View>
            )}
          </Animated.View>
        </View>
        <Animated.View style={[styles.footer, motion.words]}>
          <TouchableOpacity style={styles.button} activeOpacity={0.9} onPress={dismiss} accessibilityRole="button">
            <Text style={styles.buttonText}>{t.start}</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

/** The coin falling into the wallet, on a soft glow */
function WalletDrop({ motion }: { motion: Motion }) {
  const t = useStrings("credits").celebration;
  return (
    <View style={styles.stage} accessible accessibilityLabel={t.a11y}>
      <View style={[styles.glow, styles.glowOuter]} />
      <View style={[styles.glow, styles.glowInner]} />
      {SPARK_ANGLES.map((angle) => (
        <Animated.View key={angle} style={[styles.spark, motion.spark(angle)]} />
      ))}
      <Animated.View style={[styles.wallet, motion.wallet]}>
        <Ionicons name="wallet" size={56} color={colors.primaryDark} />
      </Animated.View>
      <Animated.View style={[styles.coin, motion.coin]}>
        <Coin size={56} />
      </Animated.View>
    </View>
  );
}

/** One credit: whose it is, where it works and the order it needs, with its amount on the right */
function CreditLine({ grant, showDate }: { grant: CreditGrantView; showDate: boolean }) {
  const t = useStrings("credits").celebration;
  const copy = useCreditCopy();
  const min = rupees(grant.minOrderAmount);
  const where = grant.storeName ? t.atStore(min) : t.anyStore(min);
  const icon = <Ionicons name="storefront" size={22} color={colors.primaryDark} />;
  return (
    <View style={styles.line}>
      <View style={[styles.mark, grant.storeName ? styles.markStore : null]}>
        {grant.storeName ? <StoreMark storeId={grant.storeId} logoUrl={grant.storeLogoUrl} size={30} fallback={icon} /> : <Coin size={56} />}
      </View>
      <View style={styles.lineText}>
        <Text style={styles.lineTitle} numberOfLines={1}>{copy.name(grant)}</Text>
        <Text style={styles.lineTerms}>{showDate ? `${where} · ${t.validTill(expiryLabel(grant.expiresAt))}` : where}</Text>
      </View>
      <Text style={styles.lineAmount}>₹{rupees(grant.amount)}</Text>
    </View>
  );
}

const MINT = "#99f6e4";

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "#042f2e", paddingHorizontal: 20 },
  body: { flex: 1, alignItems: "center", justifyContent: "center" },
  stage: { width: 220, height: 190, alignItems: "center", justifyContent: "flex-end", marginBottom: 44 },
  glow: { position: "absolute", borderRadius: 999, backgroundColor: colors.primaryLight },
  glowOuter: { width: 200, height: 200, bottom: -35, opacity: 0.08 },
  glowInner: { width: 160, height: 160, bottom: -15, opacity: 0.14 },
  wallet: {
    width: 104, height: 104, borderRadius: 52, backgroundColor: "#ccfbf1", alignItems: "center", justifyContent: "center",
    borderWidth: 4, borderColor: colors.primaryLight, marginBottom: 13,
  },
  coin: { position: "absolute", top: 30 },
  spark: { position: "absolute", bottom: 60, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  words: { alignItems: "center", alignSelf: "stretch" },
  eyebrow: { fontFamily: fonts.bold, fontSize: 13, letterSpacing: 1.5, textTransform: "uppercase", color: MINT },
  amount: { fontFamily: fonts.extrabold, fontSize: 64, lineHeight: 74, color: colors.accent, marginTop: 4 },
  subtitle: { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 26, color: "#fff", textAlign: "center" },
  lines: { alignSelf: "stretch", gap: 10, marginTop: 24 },
  line: {
    flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(153,246,228,0.18)",
  },
  mark: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  markStore: { backgroundColor: "#fff" },
  lineText: { flex: 1 },
  lineTitle: { fontFamily: fonts.bold, fontSize: 16, color: "#fff" },
  lineTerms: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: MINT, marginTop: 2 },
  lineAmount: { fontFamily: fonts.extrabold, fontSize: 20, color: colors.accent },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 6, marginTop: 16, paddingVertical: 6, paddingHorizontal: 12,
    borderRadius: 999, backgroundColor: "rgba(251,191,36,0.12)",
  },
  chipText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.accent },
  footer: { alignSelf: "stretch" },
  button: { minHeight: 54, borderRadius: 14, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  buttonText: { fontFamily: fonts.bold, fontSize: 17, color: colors.accentText },
});
