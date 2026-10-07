import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { router, type Href } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../constants/theme";

// Phone sign-ups get a generated placeholder email; it is not something to show the customer
const PLACEHOLDER_EMAIL_DOMAIN = "@phone.martly.app";

const formatPhone = (phone: string) =>
  /^\d{10}$/.test(phone) ? `+91 ${phone.slice(0, 5)} ${phone.slice(5)}` : phone;

interface Props {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  walletBalance: number;
  loyaltyPoints: number;
  isMember: boolean;
  onEdit: () => void;
}

function Stat({ icon, value, label, href, highlight }: {
  icon: keyof typeof Ionicons.glyphMap; value: string; label: string; href: Href; highlight?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.stat} onPress={() => router.push(href)} activeOpacity={0.8}>
      <Ionicons name={icon} size={18} color={highlight ? colors.accent : colors.primary} />
      <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

export function ProfileHeader({ name, phone, email, walletBalance, loyaltyPoints, isMember, onEdit }: Props) {
  const initials = (name || "U").split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  const contact = [phone && formatPhone(phone), email && !email.endsWith(PLACEHOLDER_EMAIL_DOMAIN) && email]
    .filter(Boolean).join("  ·  ");
  return (
    <View>
      <LinearGradient colors={["#134e4a", colors.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
        <View style={styles.orb} />
        <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
        <View style={styles.identity}>
          <Text style={styles.name} numberOfLines={1}>{name || "Martly customer"}</Text>
          {contact ? <Text style={styles.contact} numberOfLines={1}>{contact}</Text> : null}
        </View>
        <TouchableOpacity style={styles.edit} onPress={onEdit} accessibilityLabel="Edit profile" hitSlop={6}>
          <Ionicons name="create-outline" size={18} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>
      <View style={styles.stats}>
        <Stat icon="wallet-outline" value={`\u20B9${walletBalance.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`} label="Wallet" href="/wallet" />
        <Stat icon="star-outline" value={loyaltyPoints.toLocaleString("en-IN")} label="Points" href="/loyalty" />
        <Stat icon="diamond" value={isMember ? "Active" : "Join"} label="Mart Plus" href="/membership" highlight />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 22, padding: 18, paddingBottom: 46, overflow: "hidden" },
  orb: {
    position: "absolute", width: 170, height: 170, borderRadius: 85, right: -50, top: -70,
    backgroundColor: "rgba(251,191,36,0.14)",
  },
  avatar: {
    width: 58, height: 58, borderRadius: 29, backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 2, borderColor: "rgba(255,255,255,0.35)", alignItems: "center", justifyContent: "center",
  },
  avatarText: { fontFamily: fonts.extrabold, fontSize: 22, color: "#fff" },
  identity: { flex: 1 },
  name: { fontFamily: fonts.extrabold, fontSize: 20, color: "#fff" },
  contact: { fontFamily: fonts.medium, fontSize: 13.5, color: "rgba(255,255,255,0.85)", marginTop: 3 },
  edit: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center", justifyContent: "center",
  },
  stats: {
    flexDirection: "row", marginHorizontal: 14, marginTop: -30, backgroundColor: "#fff", borderRadius: 16,
    borderWidth: 1, borderColor: colors.border, paddingVertical: 12,
    shadowColor: "#0f172a", shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  stat: { flex: 1, alignItems: "center", gap: 2 },
  statValue: { fontFamily: fonts.extrabold, fontSize: 16, color: colors.text, marginTop: 4 },
  statLabel: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary },
});
