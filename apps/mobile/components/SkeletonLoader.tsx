import { useEffect, useRef } from "react";
import { View, Animated, StyleSheet } from "react-native";
import { colors, spacing } from "../constants/theme";
import { GRID_CARD_WIDTH, GRID_GAP, GRID_IMAGE_HEIGHT, GRID_H_PADDING } from "./ProductGridCard";

interface SkeletonBoxProps {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: object;
}

export function SkeletonBox({ width, height, borderRadius = 6, style }: SkeletonBoxProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        { width: width as number, height, borderRadius, backgroundColor: colors.border, opacity },
        style,
      ]}
    />
  );
}

export function ProductCardSkeleton() {
  return (
    <View style={sk.card}>
      <View style={sk.cardBody}>
        <SkeletonBox width={72} height={72} />
        <View style={sk.cardContent}>
          <SkeletonBox width={80} height={12} />
          <SkeletonBox width="90%" height={14} style={{ marginTop: 6 }} />
          <SkeletonBox width={60} height={12} style={{ marginTop: 6 }} />
        </View>
      </View>
      <SkeletonBox width={90} height={32} borderRadius={6} style={{ alignSelf: "flex-end", marginTop: spacing.sm }} />
    </View>
  );
}

export function CategoryCardSkeleton() {
  return (
    <View style={sk.categoryCard}>
      <SkeletonBox width={64} height={64} borderRadius={32} />
      <SkeletonBox width={56} height={12} style={{ marginTop: spacing.xs }} />
    </View>
  );
}

export function ProductDetailSkeleton() {
  return (
    <View style={sk.detailContainer}>
      <SkeletonBox width="100%" height={280} borderRadius={0} />
      <View style={sk.detailBody}>
        <SkeletonBox width={80} height={12} />
        <SkeletonBox width="80%" height={22} style={{ marginTop: spacing.sm }} />
        <SkeletonBox width={120} height={14} style={{ marginTop: spacing.xs }} />
        <SkeletonBox width="100%" height={60} style={{ marginTop: spacing.md }} />
        <SkeletonBox width="100%" height={100} borderRadius={8} style={{ marginTop: spacing.md }} />
        <SkeletonBox width="100%" height={80} borderRadius={8} style={{ marginTop: spacing.md }} />
      </View>
    </View>
  );
}

export function ProductGridCardSkeleton() {
  return (
    <View style={sk.gridCard}>
      <SkeletonBox width={GRID_CARD_WIDTH} height={GRID_IMAGE_HEIGHT} borderRadius={0} />
      <View style={sk.gridCardContent}>
        <SkeletonBox width="85%" height={13} />
        <SkeletonBox width="50%" height={11} style={{ marginTop: 4 }} />
        <View style={sk.gridCardFooter}>
          <SkeletonBox width={50} height={15} />
          <SkeletonBox width={50} height={24} borderRadius={6} />
        </View>
      </View>
    </View>
  );
}

export function HomeScreenSkeleton() {
  return (
    <View style={sk.homeContainer}>
      {/* Header area */}
      <View style={sk.homeHeader}>
        <View style={sk.homeHeaderRow}>
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1, gap: 10 }}>
            <SkeletonBox width={36} height={36} borderRadius={10} />
            <View style={{ flex: 1 }}>
              <SkeletonBox width={60} height={10} />
              <SkeletonBox width={120} height={14} style={{ marginTop: 4 }} />
            </View>
          </View>
          <SkeletonBox width={40} height={40} borderRadius={12} />
        </View>
        <SkeletonBox width="100%" height={42} borderRadius={10} />
      </View>
      {/* Greeting */}
      <View style={{ padding: spacing.md, paddingBottom: 0 }}>
        <SkeletonBox width={180} height={22} style={{ marginBottom: 6 }} />
        <SkeletonBox width={200} height={14} />
      </View>
      {/* Banner */}
      <View style={{ padding: spacing.md }}>
        <SkeletonBox width="100%" height={160} borderRadius={16} />
      </View>
      {/* Categories */}
      <View style={{ paddingHorizontal: spacing.md }}>
        <SkeletonBox width={140} height={17} style={{ marginBottom: spacing.sm }} />
        <View style={sk.categoryRow}>
          {[1, 2, 3, 4, 5].map((i) => (
            <CategoryCardSkeleton key={i} />
          ))}
        </View>
      </View>
      {/* Featured products */}
      <View style={{ paddingHorizontal: spacing.md, marginTop: spacing.lg }}>
        <SkeletonBox width={160} height={17} style={{ marginBottom: spacing.sm }} />
        <View style={{ flexDirection: "row", gap: 12 }}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={{ width: 156, borderRadius: 12, overflow: "hidden", backgroundColor: "#fff" }}>
              <SkeletonBox width={156} height={100} borderRadius={0} />
              <View style={{ padding: 10, gap: 8 }}>
                <SkeletonBox width="80%" height={12} />
                <SkeletonBox width="50%" height={12} />
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

export function OrderCardSkeleton() {
  return (
    <View style={sk.orderCard}>
      <View style={sk.orderHeader}>
        <SkeletonBox width={100} height={16} />
        <SkeletonBox width={80} height={24} borderRadius={12} />
      </View>
      <View style={sk.orderBody}>
        <SkeletonBox width={60} height={14} />
        <SkeletonBox width={80} height={14} />
      </View>
      <SkeletonBox width={70} height={16} style={{ marginTop: spacing.xs }} />
    </View>
  );
}

export function OrderDetailSkeleton() {
  return (
    <View style={sk.detailContainer}>
      <View style={sk.detailBody}>
        {/* Header */}
        <View style={sk.orderHeader}>
          <SkeletonBox width={160} height={22} />
          <SkeletonBox width={80} height={24} borderRadius={12} />
        </View>
        {/* Progress */}
        <View style={{ marginVertical: spacing.md }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
              <SkeletonBox width={14} height={14} borderRadius={7} />
              <SkeletonBox width={120} height={14} style={{ marginLeft: spacing.sm }} />
            </View>
          ))}
        </View>
        {/* Address */}
        <SkeletonBox width={120} height={16} style={{ marginBottom: spacing.sm }} />
        <SkeletonBox width="100%" height={40} />
        {/* Items */}
        <SkeletonBox width={60} height={16} style={{ marginTop: spacing.lg, marginBottom: spacing.sm }} />
        {[1, 2].map((i) => (
          <View key={i} style={sk.orderItemRow}>
            <SkeletonBox width="60%" height={14} />
            <SkeletonBox width={60} height={14} />
          </View>
        ))}
        {/* Total */}
        <View style={sk.orderItemRow}>
          <SkeletonBox width={50} height={18} />
          <SkeletonBox width={70} height={18} />
        </View>
      </View>
    </View>
  );
}

const sk = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardBody: { flexDirection: "row", gap: spacing.sm },
  cardContent: { flex: 1 },
  categoryCard: { alignItems: "center", marginRight: spacing.md },
  categoryRow: { flexDirection: "row" },
  homeContainer: { flex: 1, backgroundColor: "#f8faf9" },
  homeHeader: {
    backgroundColor: "#fff",
    padding: GRID_H_PADDING,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  homeHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  gridRow: { flexDirection: "row", justifyContent: "space-between" },
  gridCard: {
    width: GRID_CARD_WIDTH,
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: GRID_GAP,
    overflow: "hidden",
  },
  gridCardContent: { padding: 10 },
  gridCardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  detailContainer: { flex: 1, backgroundColor: colors.background },
  detailBody: { padding: spacing.md },
  orderCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  orderBody: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  orderItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
});
