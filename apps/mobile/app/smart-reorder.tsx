import { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { Loader } from "../components/Loader";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../lib/api";
import type { Translations } from "../lib/types";
import { useStore } from "../lib/store-context";
import { useCart } from "../lib/cart-context";
import { useToast } from "../lib/toast-context";
import { useMembership, getBestPrice } from "../lib/membership-context";
import { colors, spacing, fontSize } from "../constants/theme";
import { ConfirmSheet } from "../components/ConfirmSheet";
import { withSignIn } from "../components/SignInPrompt";
import { useStrings } from "../lib/i18n/use-strings";
import { strings } from "../lib/i18n";
import { useLanguage } from "../lib/language-context";

interface Prediction {
  orderCount: number;
  avgQuantity: number;
  avgIntervalDays: number | null;
  daysSinceLast: number;
  predictedNeed: number;
  status: "overdue" | "due_soon" | "not_yet";
}

interface Pricing {
  effectivePrice: number;
  originalPrice: number;
  discountActive: boolean;
  savingsAmount: number;
  savingsPercent: number;
  memberPrice: number | null;
}

interface ReorderItem {
  id: string;
  productId: string;
  variantId: string;
  price: number;
  stock: number;
  availableStock: number;
  product: {
    id: string;
    name: string;
    translations?: Translations | null;
    description: string | null;
    imageUrl: string | null;
    brand: { id: string; name: string } | null;
    category: { id: string; name: string } | null;
  };
  variant: {
    id: string;
    name: string;
    unitType: string;
    unitValue: number;
    imageUrl?: string | null;
  };
  pricing: Pricing;
  prediction: Prediction;
  suggestedQuantity: number;
}

interface ReorderSummary {
  totalProducts: number;
  overdueCount: number;
  dueSoonCount: number;
  estimatedTotal: number;
}

interface ReorderData {
  items: ReorderItem[];
  summary: ReorderSummary;
}

function SmartReorderScreen() {
  const t = useStrings("subscriptions");
  const common = useStrings("common");
  const { getLocalizedName } = useLanguage();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { selectedStore } = useStore();
  const storeId = selectedStore?.id;
  const { storeId: cartStoreId, addItem } = useCart();
  const toast = useToast();
  const { isMember } = useMembership();

  const [data, setData] = useState<ReorderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [quantities, setQuantities] = useState<Map<string, number>>(new Map());
  const [replaceCartConfirm, setReplaceCartConfirm] = useState<{ pending: () => void } | null>(null);

  const fetchData = useCallback(async () => {
    if (!storeId) {
      setLoading(false);
      return;
    }
    try {
      const res = await api.get<ReorderData>(`/api/v1/smart-reorder?storeId=${storeId}`);
      setData(res.data);

      // Auto-select overdue and due_soon items, init quantities
      const autoSelected = new Set<string>();
      const initQty = new Map<string, number>();
      for (const item of res.data.items) {
        initQty.set(item.id, item.suggestedQuantity);
        if (item.prediction.status === "overdue" || item.prediction.status === "due_soon") {
          autoSelected.add(item.id);
        }
      }
      setSelectedIds(autoSelected);
      setQuantities(initQty);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [storeId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const updateQty = useCallback((id: string, delta: number) => {
    setQuantities((prev) => {
      const next = new Map(prev);
      const current = next.get(id) ?? 1;
      const newQty = Math.max(1, current + delta);
      next.set(id, newQty);
      return next;
    });
  }, []);

  const selectedItems = useMemo(() => {
    if (!data) return [];
    return data.items.filter((item) => selectedIds.has(item.id));
  }, [data, selectedIds]);

  const selectedTotal = useMemo(() => {
    let total = 0;
    for (const item of selectedItems) {
      const qty = quantities.get(item.id) ?? item.suggestedQuantity;
      total += item.pricing.effectivePrice * qty;
    }
    return Math.round(total);
  }, [selectedItems, quantities]);

  const handleAddAllToCart = useCallback(() => {
    if (!selectedStore || selectedItems.length === 0) return;

    const doAdd = () => {
      for (const item of selectedItems) {
        const qty = quantities.get(item.id) ?? item.suggestedQuantity;
        for (let i = 0; i < qty; i++) {
          addItem(selectedStore, {
            storeProductId: item.id,
            productId: item.product.id,
            productName: item.product.name,
            translations: item.product.translations,
            variantId: item.variant.id,
            variantName: item.variant.name,
            price: getBestPrice(item, isMember),
            imageUrl: item.product.imageUrl ?? item.variant.imageUrl ?? null,
          });
        }
      }
      toast.show(t.reorder.addedToCart(selectedItems.length), "success");
      router.push("/(tabs)/cart" as any);
    };

    if (cartStoreId && cartStoreId !== selectedStore.id) {
      setReplaceCartConfirm({ pending: doAdd });
      return;
    }

    doAdd();
  }, [selectedStore, selectedItems, quantities, cartStoreId, addItem, toast, router, isMember, t]);

  const selectAll = useCallback(() => {
    if (!data) return;
    setSelectedIds(new Set(data.items.map((i) => i.id)));
  }, [data]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const allSelected = data ? selectedIds.size === data.items.length : false;

  // Loading state
  if (loading) {
    return (
      <View style={styles.center}>
        <Loader size="large" />
        <Text style={styles.loadingText}>{t.reorder.analyzing}</Text>
      </View>
    );
  }

  // No store selected
  if (!storeId) {
    return (
      <View style={styles.center}>
        <View style={styles.emptyIconCircle}>
          <Ionicons name="storefront-outline" size={32} color="#94a3b8" />
        </View>
        <Text style={styles.emptyTitle}>{t.reorder.noStore}</Text>
        <Text style={styles.emptySubtitle}>{t.reorder.noStoreHint}</Text>
      </View>
    );
  }

  // Empty state
  if (!data || data.items.length === 0) {
    return (
      <View style={styles.center}>
        <View style={styles.emptyIconCircle}>
          <Ionicons name="analytics-outline" size={32} color="#94a3b8" />
        </View>
        <Text style={styles.emptyTitle}>{t.reorder.noHistory}</Text>
        <Text style={styles.emptySubtitle}>
          {t.reorder.noHistoryHint}
        </Text>
        <TouchableOpacity
          style={styles.shopBtn}
          onPress={() => router.push("/(tabs)")}
          activeOpacity={0.8}
        >
          <Text style={styles.shopBtnText}>{t.reorder.startShopping}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const renderItem = ({ item }: { item: ReorderItem }) => {
    const isSelected = selectedIds.has(item.id);
    const qty = quantities.get(item.id) ?? item.suggestedQuantity;
    const pred = item.prediction;
    const pricing = item.pricing;

    const badgeConfig = STATUS_BADGE[pred.status];

    return (
      <TouchableOpacity
        style={[styles.card, isSelected && styles.cardSelected]}
        onPress={() => toggleSelect(item.id)}
        activeOpacity={0.7}
      >
        {/* Checkbox */}
        <TouchableOpacity
          style={styles.checkboxWrap}
          onPress={() => toggleSelect(item.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
            {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
          </View>
        </TouchableOpacity>

        {/* Product Image */}
        <View style={styles.imageWrap}>
          {item.product.imageUrl ? (
            <Image source={{ uri: item.product.imageUrl }} style={styles.productImage} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="cube-outline" size={24} color="#cbd5e1" />
            </View>
          )}
        </View>

        {/* Content */}
        <View style={styles.cardContent}>
          {/* Top row: name + badge */}
          <View style={styles.nameRow}>
            <Text style={styles.productName} numberOfLines={2}>
              {getLocalizedName(item.product)}
            </Text>
          </View>

          {/* Variant + Price */}
          <View style={styles.variantPriceRow}>
            <Text style={styles.variantText}>
              {item.variant.name}
            </Text>
            <View style={styles.priceGroup}>
              <Text style={styles.price}>
                {"\u20B9"}{Math.round(pricing.effectivePrice)}
              </Text>
              {pricing.discountActive && (
                <Text style={styles.originalPrice}>
                  {"\u20B9"}{Math.round(pricing.originalPrice)}
                </Text>
              )}
            </View>
          </View>

          {/* Prediction badge + info */}
          <View style={styles.predictionRow}>
            <View style={[styles.badge, { backgroundColor: badgeConfig.bg }]}>
              <Ionicons name={badgeConfig.icon as any} size={10} color={badgeConfig.color} />
              <Text style={[styles.badgeText, { color: badgeConfig.color }]}>
                {badgeConfig.label(pred)}
              </Text>
            </View>
          </View>

          {/* Timing info */}
          <Text style={styles.timingText}>
            {t.reorder.timing(pred.daysSinceLast, pred.avgIntervalDays)}
          </Text>

          {/* Quantity stepper */}
          {isSelected && (
            <View style={styles.stepperRow}>
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => updateQty(item.id, -1)}
                activeOpacity={0.7}
              >
                <Ionicons name="remove" size={16} color={colors.primary} />
              </TouchableOpacity>
              <Text style={styles.stepperQty}>{qty}</Text>
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => updateQty(item.id, 1)}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={16} color={colors.primary} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList keyboardDismissMode="on-drag"
        data={data.items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 80 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListHeaderComponent={
          <>
            {/* Summary Card */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryHeader}>
                <View style={styles.summaryIconWrap}>
                  <Ionicons name="analytics" size={18} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.summaryTitle}>{t.reorder.title}</Text>
                  <Text style={styles.summarySubtitle}>
                    {t.reorder.basedOn}
                  </Text>
                </View>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{data.summary.totalProducts}</Text>
                  <Text style={styles.statLabel} numberOfLines={1}>{t.reorder.products}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: "#dc2626" }]}>
                    {data.summary.overdueCount}
                  </Text>
                  <Text style={styles.statLabel} numberOfLines={1}>{t.reorder.overdue}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: "#d97706" }]}>
                    {data.summary.dueSoonCount}
                  </Text>
                  <Text style={styles.statLabel} numberOfLines={1}>{t.reorder.dueSoon}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: colors.primary }]}>
                    {"\u20B9"}{data.summary.estimatedTotal}
                  </Text>
                  <Text style={styles.statLabel} numberOfLines={1}>{t.reorder.estTotal}</Text>
                </View>
              </View>
            </View>

            {/* Select All / Deselect */}
            <View style={styles.selectRow}>
              <Text style={styles.selectLabel}>
                {t.reorder.selected(selectedIds.size, data.items.length)}
              </Text>
              <TouchableOpacity
                onPress={allSelected ? deselectAll : selectAll}
                activeOpacity={0.7}
              >
                <Text style={styles.selectAction}>
                  {allSelected ? t.reorder.deselectAll : t.reorder.selectAll}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        }
      />

      {/* Sticky Bottom Bar */}
      {selectedItems.length > 0 && (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.bottomInfo}>
            <Text style={styles.bottomCount}>
              {common.items(selectedItems.length)}
            </Text>
            <Text style={styles.bottomTotal}>{"\u20B9"}{selectedTotal}</Text>
          </View>
          <TouchableOpacity
            style={styles.addToCartBtn}
            onPress={handleAddAllToCart}
            activeOpacity={0.8}
          >
            <Ionicons name="cart" size={18} color="#fff" />
            <Text style={styles.addToCartText}>{t.reorder.addToCart}</Text>
          </TouchableOpacity>
        </View>
      )}

      <ConfirmSheet
        visible={replaceCartConfirm !== null}
        title={t.reorder.replaceTitle}
        message={t.reorder.replaceMessage}
        icon="cart-outline"
        iconColor="#f59e0b"
        confirmLabel={t.reorder.replace}
        onConfirm={() => {
          replaceCartConfirm?.pending();
          setReplaceCartConfirm(null);
        }}
        onCancel={() => setReplaceCartConfirm(null)}
      />
    </View>
  );
}

const STATUS_BADGE: Record<
  string,
  { bg: string; color: string; icon: string; label: (p: Prediction) => string }
> = {
  overdue: {
    bg: "#fef2f2",
    color: "#dc2626",
    icon: "alert-circle",
    label: () => strings("subscriptions").reorder.overdue,
  },
  due_soon: {
    bg: "#fffbeb",
    color: "#d97706",
    icon: "time",
    label: () => strings("subscriptions").reorder.dueSoon,
  },
  not_yet: {
    bg: "#f1f5f9",
    color: "#64748b",
    icon: "repeat",
    label: (p) => strings("subscriptions").reorder.bought(p.orderCount),
  },
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8faf9",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8faf9",
    padding: 32,
  },
  loadingText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 12,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 20,
    paddingHorizontal: 24,
  },
  shopBtn: {
    marginTop: 20,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  shopBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  listContent: {
    padding: 16,
  },

  // Summary Card
  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  summaryIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  summarySubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 14,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
    fontWeight: "500",
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: "#e2e8f0",
  },

  // Select Row
  selectRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  selectLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  selectAction: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primary,
  },

  // Product Card
  card: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: "#f1f5f9",
    alignItems: "flex-start",
  },
  cardSelected: {
    borderColor: colors.primary + "40",
    backgroundColor: colors.primary + "04",
  },
  checkboxWrap: {
    paddingRight: 10,
    paddingTop: 2,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#d1d5db",
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  imageWrap: {
    width: 64,
    height: 64,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#f8fafc",
  },
  productImage: {
    width: 64,
    height: 64,
    mixBlendMode: "multiply",
  },
  imagePlaceholder: {
    width: 64,
    height: 64,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
  },
  cardContent: {
    flex: 1,
    marginLeft: 12,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  productName: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    flex: 1,
    lineHeight: 19,
  },
  variantPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  variantText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  priceGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  price: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  originalPrice: {
    fontSize: 12,
    color: "#94a3b8",
    textDecorationLine: "line-through",
  },
  predictionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    gap: 8,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  timingText: {
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 4,
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginTop: 8,
    backgroundColor: "#f1f5f9",
    borderRadius: 16,
    overflow: "hidden",
  },
  stepperBtn: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  stepperQty: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    minWidth: 28,
    textAlign: "center",
  },

  // Bottom Bar
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
  },
  bottomInfo: {
    flex: 1,
  },
  bottomCount: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  bottomTotal: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
    marginTop: 1,
  },
  addToCartBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  addToCartText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
});

export default withSignIn(SmartReorderScreen, "refresh-outline", () => ({
  title: strings("subscriptions").reorder.signInTitle,
  message: strings("subscriptions").reorder.signInMessage,
}));
