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
import { colors, spacing, fontSize } from "../constants/theme";

interface WalletTransaction {
  id: string;
  type: "CREDIT" | "DEBIT";
  amount: string;
  balanceAfter: string;
  description: string | null;
  orderId: string | null;
  createdAt: string;
}

interface WalletData {
  balance: number;
  transactions: WalletTransaction[];
}

export default function WalletScreen() {
  const router = useRouter();
  const [data, setData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchWallet = useCallback(async () => {
    try {
      const res = await api.get<WalletData>("/api/v1/wallet");
      setData(res.data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchWallet();
  }, [fetchWallet]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchWallet();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const balance = data?.balance ?? 0;
  const transactions = data?.transactions ?? [];

  const renderTransaction = ({ item }: { item: WalletTransaction }) => {
    const isCredit = item.type === "CREDIT";
    const amount = Number(item.amount);
    const date = new Date(item.createdAt);

    return (
      <TouchableOpacity
        style={styles.txRow}
        activeOpacity={item.orderId ? 0.7 : 1}
        onPress={() => {
          if (item.orderId) router.push(`/order/${item.orderId}`);
        }}
      >
        <View style={[styles.txIconWrap, isCredit ? styles.txIconCredit : styles.txIconDebit]}>
          <Ionicons
            name={isCredit ? "arrow-down" : "arrow-up"}
            size={18}
            color={isCredit ? "#16a34a" : "#ef4444"}
          />
        </View>
        <View style={styles.txInfo}>
          <Text style={styles.txDescription} numberOfLines={1}>
            {item.description ?? (isCredit ? "Wallet credit" : "Wallet debit")}
          </Text>
          <Text style={styles.txDate}>
            {date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
            {" \u00B7 "}
            {date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
          </Text>
        </View>
        <View style={styles.txAmountWrap}>
          <Text style={[styles.txAmount, isCredit ? styles.txAmountCredit : styles.txAmountDebit]}>
            {isCredit ? "+" : "-"}{"\u20B9"}{amount.toFixed(0)}
          </Text>
          {item.orderId && (
            <Ionicons name="chevron-forward" size={14} color="#94a3b8" style={{ marginTop: 2 }} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const ListHeader = () => (
    <View style={styles.balanceCard}>
      <View style={styles.balanceIconWrap}>
        <Ionicons name="wallet" size={28} color="#fff" />
      </View>
      <Text style={styles.balanceLabel}>Wallet Balance</Text>
      <Text style={styles.balanceAmount}>{"\u20B9"}{balance.toFixed(2)}</Text>
      <Text style={styles.balanceHint}>
        Use your wallet balance at checkout for instant payments
      </Text>
    </View>
  );

  const ListEmpty = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name="receipt-outline" size={36} color="#94a3b8" />
      </View>
      <Text style={styles.emptyTitle}>No transactions yet</Text>
      <Text style={styles.emptySubtitle}>
        Cancelled order refunds and wallet payments will appear here
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
    backgroundColor: colors.primary,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 20,
    shadowColor: colors.primary,
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
    fontSize: 36,
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
  txIconCredit: {
    backgroundColor: "#f0fdf4",
  },
  txIconDebit: {
    backgroundColor: "#fef2f2",
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
  txAmountCredit: {
    color: "#16a34a",
  },
  txAmountDebit: {
    color: "#ef4444",
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
