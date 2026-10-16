import { useState } from "react";
import { View, Text, Pressable, FlatList, StyleSheet, ActivityIndicator } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { AuthTokens, OrgSummary } from "@martly/shared/types";
import { useAuth } from "../../lib/auth-context";
import { api, setAccessToken } from "../../lib/api";
import { colors, spacing, fontSize, fonts } from "../../constants/theme";

export default function SelectOrgScreen() {
  const { login } = useAuth();
  const insets = useSafeAreaInsets();
  const { token, orgs } = useLocalSearchParams<{ token: string; orgs: string }>();
  const organizations: OrgSummary[] = orgs ? JSON.parse(orgs) : [];
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function choose(org: OrgSummary) {
    setError("");
    setPendingId(org.id);
    setAccessToken(token);
    try {
      const res = await api.post<AuthTokens>("/api/v1/auth/select-org", { organizationId: org.id });
      await login(res.data);
    } catch (err) {
      setAccessToken(null);
      setError(err instanceof Error ? err.message : "Couldn't open this organization");
      setPendingId(null);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.lg }]}>
      <Pressable onPress={() => router.back()} style={styles.back} accessibilityLabel="Back">
        <Ionicons name="arrow-back" size={22} color={colors.text} />
      </Pressable>
      <Text style={styles.title}>Choose organization</Text>
      <Text style={styles.subtitle}>You have access to {organizations.length} organizations. You can switch later by signing in again.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList keyboardDismissMode="on-drag"
        data={organizations}
        keyExtractor={(o) => o.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => choose(item)}
            disabled={pendingId !== null}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.name.slice(0, 1).toUpperCase()}</Text>
            </View>
            <View style={styles.rowText}>
              <Text style={styles.orgName}>{item.name}</Text>
              <Text style={styles.orgSlug}>{item.slug}</Text>
            </View>
            {pendingId === item.id
              ? <ActivityIndicator color={colors.primary} />
              : <Ionicons name="chevron-forward" size={18} color="#94a3b8" />}
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.lg },
  back: { width: 44, height: 44, justifyContent: "center", marginLeft: -8 },
  title: { fontSize: 24, fontWeight: "700", color: colors.text, marginTop: spacing.sm },
  subtitle: { fontSize: fontSize.md, color: colors.textSecondary, lineHeight: 20, marginTop: 6 },
  error: { color: colors.error, fontSize: fontSize.md, marginTop: spacing.md },
  list: { paddingVertical: spacing.lg, gap: 10 },
  row: {
    flexDirection: "row", alignItems: "center", gap: 12, minHeight: 68, paddingHorizontal: 14,
    borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: "#fff",
  },
  rowPressed: { backgroundColor: "#f8fafc" },
  avatar: { width: 40, height: 40, borderRadius: 10, backgroundColor: "#f0fdfa", alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: fonts.extrabold, fontSize: 17, color: colors.primary },
  rowText: { flex: 1 },
  orgName: { fontFamily: fonts.bold, fontSize: 15.5, color: colors.text },
  orgSlug: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary, marginTop: 2 },
});
