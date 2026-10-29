import { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Share,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Loader } from "../components/Loader";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { api } from "../lib/api";
import { useStore } from "../lib/store-context";
import { useToast } from "../lib/toast-context";
import { useKeyboardReveal } from "../lib/use-keyboard-reveal";
import { colors, spacing, fontSize } from "../constants/theme";
import type { ReferralInfo, ReferralItem } from "../lib/types";
import { withSignIn } from "../components/SignInPrompt";
import { strings } from "../lib/i18n";
import { useStrings } from "../lib/i18n/use-strings";
import { formatDate } from "../lib/i18n/format";

type ReferralStatus = "PENDING" | "COMPLETED" | "EXPIRED";

const STATUS_COLORS: Record<ReferralStatus, { bg: string; text: string }> = {
  PENDING: { bg: "#fef3c7", text: "#92400e" },
  COMPLETED: { bg: "#dcfce7", text: "#166534" },
  EXPIRED: { bg: "#fee2e2", text: "#991b1b" },
};

function ReferralScreen() {
  const t = useStrings("account").referral;
  const { selectedStore } = useStore();
  const storeId = selectedStore?.id;
  const { show: showToast } = useToast();
  const keyboard = useKeyboardReveal();

  const [data, setData] = useState<ReferralInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [code, setCode] = useState("");
  const [applying, setApplying] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get<ReferralInfo>("/api/v1/referrals");
      setData(res.data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const copyCode = async () => {
    if (!data?.referralCode) return;
    await Clipboard.setStringAsync(data.referralCode);
    showToast(t.copied, "success");
  };

  const shareCode = async () => {
    if (!data?.referralCode) return;
    try {
      await Share.share({
        message: t.shareMessage(data.referralCode),
      });
    } catch {
      // user cancelled
    }
  };

  const applyCode = async () => {
    if (!code.trim()) {
      showToast(t.enterCode, "error");
      return;
    }
    if (!storeId) {
      showToast(t.selectStore, "error");
      return;
    }
    setApplying(true);
    try {
      await api.post("/api/v1/referrals/apply", { code: code.trim(), storeId });
      showToast(t.applied, "success");
      setCode("");
      fetchData();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || t.applyFailed;
      showToast(msg, "error");
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <Loader size="large" />
      </View>
    );
  }

  const referrals = data?.referrals ?? [];

  return (
    <View ref={keyboard.rootRef} onLayout={keyboard.onRootLayout} style={{ flex: 1 }}>
      <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={keyboard.topOffset}
    >
    <ScrollView keyboardDismissMode="on-drag"
      ref={keyboard.scrollRef}
      onScroll={keyboard.onScroll}
      scrollEventThrottle={16}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {/* Your Referral Code */}
      <View style={styles.codeCard}>
        <View style={styles.codeHeader}>
          <Ionicons name="gift-outline" size={24} color={colors.primary} />
          <Text style={styles.codeTitle}>{t.yourCode}</Text>
        </View>
        <Text style={styles.codeSubtitle}>{t.codeSubtitle}</Text>
        <View style={styles.codeBox}>
          <Text style={styles.codeText}>{data?.referralCode ?? "—"}</Text>
        </View>
        <View style={styles.codeActions}>
          <TouchableOpacity style={styles.actionBtn} onPress={copyCode}>
            <Ionicons name="copy-outline" size={18} color={colors.primary} />
            <Text style={styles.actionBtnText}>{t.copy}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.shareBtn]} onPress={shareCode}>
            <Ionicons name="share-social-outline" size={18} color="#fff" />
            <Text style={[styles.actionBtnText, { color: "#fff" }]}>{t.share}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Enter a Code */}
      {!data?.appliedReferral && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.haveCode}</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder={t.placeholder}
              placeholderTextColor="#94a3b8"
              value={code}
              onChangeText={setCode}
              autoCapitalize="characters"
              editable={!applying}
            />
            <TouchableOpacity
              style={[styles.applyBtn, applying && { opacity: 0.6 }]}
              onPress={applyCode}
              disabled={applying}
            >
              {applying ? (
                <Loader size="small" color="#fff" />
              ) : (
                <Text style={styles.applyBtnText}>{t.apply}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Applied Referral */}
      {data?.appliedReferral && (
        <View style={styles.appliedCard}>
          <View style={styles.appliedRow}>
            <Ionicons name="checkmark-circle" size={20} color="#16a34a" />
            <Text style={styles.appliedText}>
              {t.referredBy} <Text style={{ fontFamily: "App-SemiBold" }}>{data.appliedReferral.referrerName}</Text>
            </Text>
          </View>
          <Text style={styles.appliedSub}>
            {data.appliedReferral.status === "COMPLETED"
              ? t.earnedCredit(data.appliedReferral.refereeReward)
              : t.creditAfterDelivery(data.appliedReferral.refereeReward)}
          </Text>
        </View>
      )}

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{data?.stats.totalReferrals ?? 0}</Text>
          <Text style={styles.statLabel}>{t.referrals}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: "#16a34a" }]}>{data?.stats.completedReferrals ?? 0}</Text>
          <Text style={styles.statLabel}>{t.completed}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: colors.primary }]}>{"\u20B9"}{data?.stats.totalEarned ?? 0}</Text>
          <Text style={styles.statLabel}>{t.earned}</Text>
        </View>
      </View>

      {/* Referral History */}
      {referrals.length > 0 ? (
        <>
          <Text style={styles.historyTitle}>{t.history}</Text>
          {referrals.map((item) => {
            const status: ReferralStatus = item.status in STATUS_COLORS ? (item.status as ReferralStatus) : "PENDING";
            const statusCfg = STATUS_COLORS[status];
            return (
              <View key={item.id} style={styles.historyItem}>
                <View style={styles.historyIcon}>
                  <Ionicons
                    name={item.status === "COMPLETED" ? "checkmark-circle" : "time-outline"}
                    size={20}
                    color={item.status === "COMPLETED" ? "#16a34a" : "#f59e0b"}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyName}>{item.refereeName}</Text>
                  <Text style={styles.historyDate}>
                    {formatDate(item.createdAt, { day: "numeric", month: "short", year: "numeric" })}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
                    <Text style={[styles.statusText, { color: statusCfg.text }]}>{t.status[status]}</Text>
                  </View>
                  {item.status === "COMPLETED" && (
                    <Text style={styles.rewardText}>{"\u20B9"}{item.referrerReward}</Text>
                  )}
                </View>
              </View>
            );
          })}
        </>
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={48} color="#cbd5e1" />
          <Text style={styles.emptyTitle}>{t.emptyTitle}</Text>
          <Text style={styles.emptySubtitle}>{t.emptySubtitle}</Text>
        </View>
      )}
    </ScrollView>
    </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
  container: {
    paddingBottom: 40,
  },
  codeCard: {
    margin: spacing.md,
    padding: spacing.lg,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  codeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  codeTitle: {
    fontSize: fontSize.lg,
    fontFamily: "App-SemiBold",
    color: colors.text,
  },
  codeSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  codeBox: {
    backgroundColor: "#f0fdfa",
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: "dashed",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: spacing.md,
  },
  codeText: {
    fontSize: 22,
    fontFamily: "App-Bold",
    color: colors.primary,
    letterSpacing: 3,
  },
  codeActions: {
    flexDirection: "row",
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: "#fff",
  },
  shareBtn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  actionBtnText: {
    fontSize: fontSize.sm,
    fontFamily: "App-SemiBold",
    color: colors.primary,
  },
  section: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontFamily: "App-SemiBold",
    color: colors.text,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: "row",
    gap: 8,
  },
  input: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: fontSize.md,
    fontFamily: "App-Regular",
    color: colors.text,
    backgroundColor: "#fff",
  },
  applyBtn: {
    height: 44,
    paddingHorizontal: 20,
    backgroundColor: colors.primary,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  applyBtnText: {
    fontSize: fontSize.sm,
    fontFamily: "App-SemiBold",
    color: "#fff",
  },
  appliedCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: "#f0fdf4",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  appliedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  appliedText: {
    fontSize: fontSize.md,
    fontFamily: "App-Regular",
    color: "#166534",
  },
  appliedSub: {
    fontSize: fontSize.sm,
    color: "#15803d",
    marginLeft: 28,
  },
  statsRow: {
    flexDirection: "row",
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: {
    fontSize: fontSize.xl,
    fontFamily: "App-Bold",
    color: colors.text,
  },
  statLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  historyTitle: {
    fontSize: fontSize.md,
    fontFamily: "App-SemiBold",
    color: colors.text,
    marginHorizontal: spacing.md,
    marginBottom: 8,
  },
  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  historyIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f8fafc",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  historyName: {
    fontSize: fontSize.md,
    fontFamily: "App-Regular",
    color: colors.text,
  },
  historyDate: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 11,
    fontFamily: "App-SemiBold",
  },
  rewardText: {
    fontSize: fontSize.sm,
    fontFamily: "App-SemiBold",
    color: "#16a34a",
    marginTop: 4,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: fontSize.md,
    fontFamily: "App-SemiBold",
    color: colors.textSecondary,
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: fontSize.sm,
    color: "#94a3b8",
    marginTop: 4,
  },
});

export default withSignIn(ReferralScreen, "people-outline", () => strings("account").signIn.referral);
