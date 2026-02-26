import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../lib/api";
import { useStore } from "../lib/store-context";
import { colors, spacing, fontSize } from "../constants/theme";
import type { LoyaltyData, LoyaltyTransaction } from "../lib/types";

export default function LoyaltyScreen() {
  const router = useRouter();
  const { selectedStore } = useStore();
  const storeId = selectedStore?.id;
  const [data, setData] = useState<LoyaltyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLoyalty = useCallback(async () => {
    if (!storeId) { setLoading(false); return; }
    try {
      const res = await api.get<LoyaltyData>(`/api/v1/loyalty?storeId=${storeId}`);
      setData(res.data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [storeId]);

  useEffect(() => {
    fetchLoyalty();
  }, [fetchLoyalty]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchLoyalty();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const balance = data?.balance ?? { points: 0, totalEarned: 0, totalRedeemed: 0 };
  const config = data?.config;
  const transactions = data?.transactions ?? [];

  const renderTransaction = ({ item }: { item: LoyaltyTransaction }) => {
    const isPositive = item.points > 0;
    const date = new Date(item.createdAt);
    const typeIcon = {
      EARN: "star",
      REDEEM: "cart",
      REVERSAL: "refresh",
      ADJUSTMENT: "construct",
    }[item.type] as any;

    return (
      <TouchableOpacity
        style={styles.txRow}
        activeOpacity={item.orderId ? 0.7 : 1}
        onPress={() => {
          if (item.orderId) router.push(`/order/${item.orderId}`);
        }}
      >
        <View style={[styles.txIconWrap, isPositive ? styles.txIconEarn : styles.txIconRedeem]}>
          <Ionicons
            name={typeIcon}
            size={18}
            color={isPositive ? "#d97706" : "#6366f1"}
          />
        </View>
        <View style={styles.txInfo}>
          <Text style={styles.txDescription} numberOfLines={1}>
            {item.description ?? item.type}
          </Text>
          <Text style={styles.txDate}>
            {date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
            {" \u00B7 "}
            {date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
          </Text>
        </View>
        <View style={styles.txAmountWrap}>
          <Text style={[styles.txAmount, isPositive ? styles.txAmountEarn : styles.txAmountRedeem]}>
            {isPositive ? "+" : ""}{item.points} pts
          </Text>
          {item.orderId && (
            <Ionicons name="chevron-forward" size={14} color="#94a3b8" style={{ marginTop: 2 }} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const ListHeader = () => (
    <>
      <View style={styles.balanceCard}>
        <View style={styles.balanceIconWrap}>
          <Ionicons name="star" size={28} color="#fff" />
        </View>
        <Text style={styles.balanceLabel}>Loyalty Points</Text>
        <Text style={styles.balanceAmount}>{balance.points}</Text>
        <Text style={styles.balanceHint}>
          {config?.isEnabled
            ? `Earn ${config.earnRate} point${config.earnRate !== 1 ? "s" : ""} per \u20B9100 spent`
            : "Loyalty program is currently inactive"}
        </Text>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Ionicons name="trending-up" size={18} color="#d97706" />
          <Text style={styles.statValue}>{balance.totalEarned}</Text>
          <Text style={styles.statLabel}>Total Earned</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="gift-outline" size={18} color="#6366f1" />
          <Text style={styles.statValue}>{balance.totalRedeemed}</Text>
          <Text style={styles.statLabel}>Redeemed</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="wallet-outline" size={18} color={colors.primary} />
          <Text style={styles.statValue}>{"\u20B9"}{balance.points}</Text>
          <Text style={styles.statLabel}>Value</Text>
        </View>
      </View>

      {/* Info banner */}
      {config?.isEnabled && (
        <View style={styles.infoBanner}>
          <Ionicons name="information-circle-outline" size={16} color="#d97706" />
          <Text style={styles.infoBannerText}>
            1 point = {"\u20B9"}1 at checkout. Min {config.minRedeemPoints} pts to redeem. Max {config.maxRedeemPercentage}% of order value.
          </Text>
        </View>
      )}

      {transactions.length > 0 && (
        <View style={styles.txHeader}>
          <Text style={styles.txHeaderText}>Activity</Text>
        </View>
      )}
    </>
  );

  const ListEmpty = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name="star-outline" size={36} color="#94a3b8" />
      </View>
      <Text style={styles.emptyTitle}>No activity yet</Text>
      <Text style={styles.emptySubtitle}>
        Place orders to start earning loyalty points
      </Text>
    </View>
  );

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={transactions}
      keyExtractor={(item) => item.id}
      renderItem={renderTransaction}
      ListHeaderComponent={ListHeader}
      ListEmptyComponent={ListEmpty}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={colors.primary}
        />
      }
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  content: {
    paddingBottom: 32,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.surface,
  },

  // Balance card
  balanceCard: {
    alignItems: "center",
    backgroundColor: "#d97706",
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.md,
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 20,
    shadowColor: "#d97706",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  balanceIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  balanceLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.8)",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  balanceAmount: {
    fontSize: 42,
    fontWeight: "800",
    color: "#fff",
    marginTop: 4,
  },
  balanceHint: {
    fontSize: 12,
    color: "rgba(255,255,255,0.65)",
    marginTop: 8,
    textAlign: "center",
  },

  // Stats row
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  statLabel: {
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: "600",
  },

  // Info banner
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: "#fffbeb",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#fde68a",
    padding: 12,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 12,
    color: "#92400e",
    lineHeight: 17,
  },

  // Transaction header
  txHeader: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  txHeaderText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // Transactions
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    backgroundColor: "#fff",
  },
  txIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  txIconEarn: {
    backgroundColor: "#fffbeb",
  },
  txIconRedeem: {
    backgroundColor: "#eef2ff",
  },
  txInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  txDescription: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  txDate: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 2,
  },
  txAmountWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  txAmount: {
    fontSize: 15,
    fontWeight: "700",
  },
  txAmountEarn: {
    color: "#d97706",
  },
  txAmountRedeem: {
    color: "#6366f1",
  },
  separator: {
    height: 1,
    backgroundColor: "#f1f5f9",
    marginLeft: 68,
  },

  // Empty state
  emptyState: {
    alignItems: "center",
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#94a3b8",
    textAlign: "center",
    marginTop: 4,
    lineHeight: 19,
  },
});
