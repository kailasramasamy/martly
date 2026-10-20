import { memo } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../../../../constants/theme";
import { useStrings } from "../../../../lib/i18n/use-strings";
import { useHomeSectionEnv } from "../context";

const H_PADDING = 16;

/** Shortcuts for what the shopper already has: their Plus membership and Tomorrow's Basket subscriptions */
export const MemberChipsSection = memo(function MemberChipsSection() {
  const t = useStrings("home");
  const { memberStatus, hasSubscriptions } = useHomeSectionEnv();
  if (!memberStatus?.isMember && !hasSubscriptions) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {memberStatus?.isMember && (
        <TouchableOpacity style={styles.chip} onPress={() => router.push("/membership")} activeOpacity={0.8}>
          <LinearGradient colors={["#fde68a", colors.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.gradient}>
            <Ionicons name="diamond" size={14} color={colors.accentText} />
            <Text style={[styles.text, styles.textOnAccent]}>{t.plusDaysLeft(memberStatus.membership?.daysLeft)}</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
      {hasSubscriptions && (
        <TouchableOpacity style={styles.chip} onPress={() => router.push("/tomorrows-basket")} activeOpacity={0.8}>
          <LinearGradient colors={[colors.primary, colors.primaryLight]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.gradient}>
            <Ionicons name="basket" size={14} color="#fff" />
            <Text style={styles.text}>{t.tomorrowsBasket}</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
      {hasSubscriptions && (
        <TouchableOpacity style={styles.chip} onPress={() => router.push("/subscriptions")} activeOpacity={0.8}>
          <View style={styles.outline}>
            <Ionicons name="repeat" size={14} color={colors.primary} />
            <Text style={styles.outlineText}>{t.subscriptions}</Text>
          </View>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: "row", paddingHorizontal: H_PADDING, paddingTop: 10, gap: 8 },
  chip: { borderRadius: 8, overflow: "hidden" },
  gradient: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, gap: 6, borderRadius: 8 },
  text: { fontSize: 12, fontWeight: "600", color: "#fff" },
  textOnAccent: { color: colors.accentText, fontWeight: "700" },
  outline: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, gap: 6, borderRadius: 8,
    borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.primary + "08",
  },
  outlineText: { fontSize: 12, fontWeight: "600", color: colors.primary },
});
