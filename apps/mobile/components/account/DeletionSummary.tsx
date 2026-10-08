import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../constants/theme";

const ERASED = [
  "Your name, phone number and email",
  "Saved addresses",
  "Wishlist and notifications",
  "Active subscriptions",
];

function Row({ icon, color, text }: { icon: keyof typeof Ionicons.glyphMap; color: string; text: string }) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={styles.rowText}>{text}</Text>
    </View>
  );
}

export function DeletionSummary({ walletBalance, loyaltyPoints, isMember }: {
  walletBalance: number;
  loyaltyPoints: number;
  isMember: boolean;
}) {
  const losses = [
    walletBalance > 0 && `₹${walletBalance.toLocaleString("en-IN")} wallet balance`,
    loyaltyPoints > 0 && `${loyaltyPoints.toLocaleString("en-IN")} loyalty points`,
    isMember && "Your Mart Plus membership",
  ].filter((item): item is string => Boolean(item));

  return (
    <>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>What will be erased</Text>
        {ERASED.map((text) => <Row key={text} icon="close-circle" color="#94a3b8" text={text} />)}
      </View>

      {losses.length > 0 && (
        <View style={[styles.card, styles.lossCard]}>
          <Text style={[styles.cardTitle, styles.lossTitle]}>You will lose</Text>
          {losses.map((text) => <Row key={text} icon="alert-circle" color="#b45309" text={text} />)}
          <Text style={styles.lossNote}>These can't be refunded or transferred.</Text>
        </View>
      )}

      <View style={styles.keptCard}>
        <Ionicons name="document-text-outline" size={20} color={colors.primary} />
        <Text style={styles.keptText}>
          Invoices and order records are kept without your personal details, as required by Indian tax law.
        </Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: colors.border,
    padding: 16, gap: 12, marginTop: 16,
  },
  cardTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.text, letterSpacing: 0 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  rowText: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.text, letterSpacing: 0 },
  lossCard: { backgroundColor: "#fffbeb", borderColor: "#fde68a" },
  lossTitle: { color: "#92400e" },
  lossNote: { fontFamily: fonts.medium, fontSize: 12.5, color: "#92400e", letterSpacing: 0 },
  keptCard: {
    flexDirection: "row", gap: 10, alignItems: "flex-start", marginTop: 16,
    backgroundColor: "#f0fdfa", borderRadius: 14, padding: 14,
  },
  keptText: { flex: 1, fontFamily: fonts.medium, fontSize: 13, lineHeight: 19, color: colors.primaryDark, letterSpacing: 0 },
});
