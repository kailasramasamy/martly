import type { ReactNode } from "react";
import { View, Text, TouchableOpacity, Image, Modal, StyleSheet } from "react-native";
import { Loader } from "../Loader";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, spacing } from "../../constants/theme";
import type { PaymentChoice, UpiApp } from "../../lib/upi-apps";
import { useStrings } from "../../lib/i18n/use-strings";

interface Props {
  choice: PaymentChoice;
  onChange: (choice: PaymentChoice) => void;
  installedApps: UpiApp[];
  isPickup: boolean;
}

const sameChoice = (a: PaymentChoice, b: PaymentChoice) =>
  a.kind === b.kind && (a.kind !== "upi" || (b.kind === "upi" && a.app === b.app));

function OptionRow({ active, onPress, icon, title, sub }: {
  active: boolean; onPress: () => void; icon: ReactNode; title: string; sub: string;
}) {
  return (
    <TouchableOpacity
      style={[styles.card, active && styles.cardActive]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
    >
      <Ionicons name={active ? "radio-button-on" : "radio-button-off"} size={20} color={active ? colors.primary : "#94a3b8"} />
      {icon}
      <View style={styles.info}>
        <Text style={[styles.title, active && { color: colors.primary }]}>{title}</Text>
        <Text style={styles.sub}>{sub}</Text>
      </View>
    </TouchableOpacity>
  );
}

/** UPI apps installed on the phone come first, so paying is "tap Google Pay, enter PIN" */
export function PaymentOptions({ choice, onChange, installedApps, isPickup }: Props) {
  const t = useStrings("checkout").payment;
  const row = (option: PaymentChoice, icon: ReactNode, title: string, sub: string) => (
    <OptionRow
      key={option.kind === "upi" ? option.app : option.kind}
      active={sameChoice(choice, option)}
      onPress={() => onChange(option)}
      icon={icon}
      title={title}
      sub={sub}
    />
  );
  const glyph = (name: keyof typeof Ionicons.glyphMap, option: PaymentChoice) => (
    <View style={styles.glyph}>
      <Ionicons name={name} size={18} color={sameChoice(choice, option) ? colors.primary : "#64748b"} />
    </View>
  );

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Ionicons name="card-outline" size={16} color={colors.primary} />
        <Text style={styles.sectionTitle}>{t.title}</Text>
      </View>
      <View style={styles.options}>
        {installedApps.map((app) =>
          row({ kind: "upi", app: app.id }, <Image source={app.logo} style={styles.logo} />, app.label, t.payUsing(app.label)),
        )}
        {row(
          { kind: "razorpay" },
          glyph("card-outline", { kind: "razorpay" }),
          installedApps.length ? t.otherUpi : t.payOnline,
          t.onlineSub,
        )}
        {row(
          { kind: "cod" },
          glyph("cash-outline", { kind: "cod" }),
          isPickup ? t.payAtStore : t.cod,
          isPickup ? t.pickupSub : t.codSub,
        )}
      </View>
    </View>
  );
}

/** Shown after returning from the UPI app while the server confirms the payment */
export function PaymentConfirming({ visible, appLabel, onCancel }: { visible: boolean; appLabel?: string; onCancel: () => void }) {
  const t = useStrings("checkout").payment;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.confirmCard}>
          <Loader size="large" />
          <Text style={styles.confirmTitle}>{t.confirmingTitle}</Text>
          <Text style={styles.confirmSub}>
            {t.confirmingSub(appLabel)}
          </Text>
          <TouchableOpacity onPress={onCancel} style={styles.confirmCancel} hitSlop={8}>
            <Text style={styles.confirmCancelText}>{t.checkLater}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: spacing.md, paddingHorizontal: spacing.md },
  header: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.sm },
  sectionTitle: { fontFamily: fonts.extrabold, fontSize: 15.5, color: colors.text, letterSpacing: -0.2 },
  options: { gap: 8 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    minHeight: 60,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  cardActive: { borderColor: colors.primary, backgroundColor: colors.primary + "06" },
  logo: { width: 30, height: 30, borderRadius: 8 },
  glyph: { width: 30, height: 30, borderRadius: 8, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  info: { flex: 1 },
  title: { fontSize: 14, fontWeight: "700", color: colors.text },
  sub: { fontSize: 12, color: "#94a3b8", marginTop: 1 },
  backdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", alignItems: "center", justifyContent: "center", padding: spacing.lg },
  confirmCard: { backgroundColor: "#fff", borderRadius: 20, padding: spacing.lg, alignItems: "center", gap: 10, width: "100%", maxWidth: 340 },
  confirmTitle: { fontFamily: fonts.extrabold, fontSize: 17, color: colors.text, marginTop: 4 },
  confirmSub: { fontSize: 13, color: colors.textSecondary, textAlign: "center", lineHeight: 19 },
  confirmCancel: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.md },
  confirmCancelText: { fontSize: 13, fontWeight: "700", color: colors.primary },
});
