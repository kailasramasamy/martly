import { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../lib/api";
import { useCart } from "../../lib/cart-context";
import { useStore } from "../../lib/store-context";
import { colors, spacing, fontSize } from "../../constants/theme";
import { ProductCard } from "../../components/ProductCard";
import { FloatingCart } from "../../components/FloatingCart";
import { ProductDetailSkeleton } from "../../components/SkeletonLoader";
import type { Product, StoreProduct, Variant } from "../../lib/types";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface ProductDetail extends Product {
  variants?: Variant[];
}

export default function ProductDetailScreen() {
  const { id, storeId: paramStoreId } = useLocalSearchParams<{ id: string; storeId?: string }>();
  const { selectedStore } = useStore();
  const { storeId: cartStoreId, items: cartItems, addItem, updateQuantity } = useCart();

  const storeId = paramStoreId || selectedStore?.id;
  const storeName = selectedStore?.name ?? "";

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [storeProducts, setStoreProducts] = useState<StoreProduct[]>([]);
  const [relatedProducts, setRelatedProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [descExpanded, setDescExpanded] = useState(false);
  const [activeImageIdx, setActiveImageIdx] = useState(0);

  // Collect all images from product and variants
  const images = useMemo(() => {
    if (!product) return [];
    const imgs: string[] = [];
    if (product.imageUrl) imgs.push(product.imageUrl);
    product.variants?.forEach((v) => {
      if (v.imageUrl && !imgs.includes(v.imageUrl)) imgs.push(v.imageUrl);
    });
    return imgs;
  }, [product]);

  const cartQuantityMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of cartItems) {
      map.set(item.storeProductId, item.quantity);
    }
    return map;
  }, [cartItems]);

  useEffect(() => {
    if (!id) return;

    const fetchProduct = api.get<ProductDetail>(`/api/v1/products/${id}`);

    const fetchStoreProducts = storeId
      ? api.getList<StoreProduct>(`/api/v1/stores/${storeId}/products`).then((res) =>
          res.data.filter((sp) => sp.product.id === id),
        )
      : Promise.resolve([]);

    const fetchRelated = storeId
      ? api.getList<StoreProduct>(`/api/v1/stores/${storeId}/products`).then((res) => res.data)
      : Promise.resolve([]);

    Promise.all([fetchProduct, fetchStoreProducts, fetchRelated])
      .then(([productRes, storeProd, allStoreProd]) => {
        setProduct(productRes.data);
        setStoreProducts(storeProd);

        // Related = same category, different product, max 10
        const catId = productRes.data.category?.id;
        if (catId) {
          const related = allStoreProd
            .filter((sp) => sp.product.category?.id === catId && sp.product.id !== id)
            .slice(0, 10);
          setRelatedProducts(related);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, storeId]);

  const handleAddToCart = (sp: StoreProduct) => {
    if (!storeId) return;

    const effectivePrice = sp.pricing?.discountActive
      ? sp.pricing.effectivePrice
      : Number(sp.price);

    const item = {
      storeProductId: sp.id,
      productName: sp.product.name,
      variantId: sp.variant.id,
      variantName: sp.variant.name,
      price: effectivePrice,
      imageUrl: sp.product.imageUrl ?? sp.variant.imageUrl,
    };

    if (cartStoreId && cartStoreId !== storeId) {
      Alert.alert(
        "Replace Cart?",
        "Your cart has items from another store. Adding this item will replace your current cart.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Replace", style: "destructive", onPress: () => addItem(storeId, storeName, item) },
        ],
      );
      return;
    }

    addItem(storeId, storeName, item);
  };

  const onImageScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setActiveImageIdx(idx);
  };

  if (loading) return <ProductDetailSkeleton />;

  if (!product) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Product not found</Text>
      </View>
    );
  }

  const nutritionalInfo = product.nutritionalInfo;
  const nutritionalEntries = nutritionalInfo ? Object.entries(nutritionalInfo) : [];

  return (
    <ScrollView style={styles.container}>
      {/* Image Gallery */}
      {images.length > 0 ? (
        <View>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onImageScroll}
            scrollEventThrottle={16}
          >
            {images.map((uri, idx) => (
              <Image key={idx} source={{ uri }} style={styles.heroImage} />
            ))}
          </ScrollView>
          {images.length > 1 && (
            <View style={styles.dotRow}>
              {images.map((_, idx) => (
                <View key={idx} style={[styles.dot, idx === activeImageIdx && styles.dotActive]} />
              ))}
            </View>
          )}
        </View>
      ) : (
        <View style={[styles.heroImage, styles.heroPlaceholder]}>
          <Text style={styles.heroPlaceholderText}>No image</Text>
        </View>
      )}

      <View style={styles.body}>
        {/* Basic Info */}
        <View style={styles.infoRow}>
          {product.foodType && (
            <View
              style={[
                styles.foodTypeDot,
                product.foodType === "VEG" || product.foodType === "VEGAN"
                  ? styles.foodTypeVeg
                  : styles.foodTypeNonVeg,
              ]}
            >
              <View
                style={[
                  styles.foodTypeDotInner,
                  product.foodType === "VEG" || product.foodType === "VEGAN"
                    ? styles.foodTypeDotVeg
                    : styles.foodTypeDotNonVeg,
                ]}
              />
            </View>
          )}
          {product.brand?.name && (
            <Text style={styles.brandName}>{product.brand.name}</Text>
          )}
        </View>

        <Text style={styles.productName}>{product.name}</Text>

        {product.category?.name && (
          <View style={styles.categoryChip}>
            <Text style={styles.categoryChipText}>{product.category.name}</Text>
          </View>
        )}

        {/* Description */}
        {product.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.descText} numberOfLines={descExpanded ? undefined : 3}>
              {product.description}
            </Text>
            {product.description.length > 120 && (
              <TouchableOpacity onPress={() => setDescExpanded(!descExpanded)}>
                <Text style={styles.readMore}>{descExpanded ? "Show less" : "Read more"}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Variants & Pricing */}
        {storeProducts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Variants & Pricing</Text>
            {storeProducts.map((sp) => {
              const hasDiscount = sp.pricing?.discountActive;
              const displayPrice = hasDiscount ? sp.pricing!.effectivePrice : Number(sp.price);
              const originalPrice = hasDiscount ? sp.pricing!.originalPrice : null;
              const available = sp.availableStock ?? (sp.stock - (sp.reservedStock ?? 0));
              const isOutOfStock = available <= 0;

              return (
                <View key={sp.id} style={styles.variantCard}>
                  <View style={styles.variantInfo}>
                    <Text style={styles.variantName}>{sp.variant.name}</Text>
                    <Text style={styles.variantUnit}>
                      {sp.variant.unitType} {sp.variant.unitValue}
                    </Text>
                    <View style={styles.priceRow}>
                      {originalPrice != null && (
                        <Text style={styles.mrpPrice}>₹{originalPrice.toFixed(2)}</Text>
                      )}
                      <Text style={styles.price}>₹{displayPrice.toFixed(2)}</Text>
                    </View>
                    {isOutOfStock && <Text style={styles.outOfStock}>Out of Stock</Text>}
                  </View>
                  {(cartQuantityMap.get(sp.id) ?? 0) > 0 ? (
                    <View style={styles.variantQtyStepper}>
                      <TouchableOpacity
                        style={styles.variantQtyBtn}
                        onPress={() => updateQuantity(sp.id, (cartQuantityMap.get(sp.id) ?? 0) - 1)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name={(cartQuantityMap.get(sp.id) ?? 0) === 1 ? "trash-outline" : "remove"} size={16} color={colors.primary} />
                      </TouchableOpacity>
                      <Text style={styles.variantQtyText}>{cartQuantityMap.get(sp.id)}</Text>
                      <TouchableOpacity
                        style={styles.variantQtyBtn}
                        onPress={() => handleAddToCart(sp)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="add" size={16} color={colors.primary} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.variantAddBtn, isOutOfStock && styles.disabledBtn]}
                      onPress={() => handleAddToCart(sp)}
                      disabled={isOutOfStock}
                    >
                      <Text style={[styles.variantAddText, isOutOfStock && styles.disabledText]}>
                        {isOutOfStock ? "Unavailable" : "Add"}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* No store selected hint */}
        {!storeId && (
          <View style={styles.hintBox}>
            <Text style={styles.hintText}>Select a store to see pricing and add to cart.</Text>
          </View>
        )}

        {/* Nutritional Info */}
        {nutritionalEntries.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Nutritional Information</Text>
            <View style={styles.table}>
              {nutritionalEntries.map(([key, value]) => (
                <View key={key} style={styles.tableRow}>
                  <Text style={styles.tableKey}>{key}</Text>
                  <Text style={styles.tableValue}>{value}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Ingredients */}
        {product.ingredients && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ingredients</Text>
            <Text style={styles.bodyText}>{product.ingredients}</Text>
          </View>
        )}

        {/* Allergens */}
        {product.allergens && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Allergens</Text>
            <View style={styles.allergenBadge}>
              <Text style={styles.allergenText}>{product.allergens}</Text>
            </View>
          </View>
        )}

        {/* Storage Instructions */}
        {product.storageInstructions && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Storage</Text>
            <Text style={styles.bodyText}>{product.storageInstructions}</Text>
          </View>
        )}

        {/* Regulatory */}
        {(product.regulatoryMarks?.length > 0 ||
          product.certifications?.length > 0 ||
          product.dangerWarnings ||
          product.manufacturer ||
          product.countryOfOrigin) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Regulatory Information</Text>

            {product.regulatoryMarks?.length > 0 && (
              <View style={styles.badgeRow}>
                {product.regulatoryMarks.map((mark) => (
                  <View key={mark} style={styles.regBadge}>
                    <Text style={styles.regBadgeText}>{mark}</Text>
                  </View>
                ))}
              </View>
            )}

            {product.certifications?.length > 0 && (
              <View style={[styles.badgeRow, { marginTop: spacing.xs }]}>
                {product.certifications.map((cert) => (
                  <View key={cert} style={styles.certBadge}>
                    <Text style={styles.certBadgeText}>{cert}</Text>
                  </View>
                ))}
              </View>
            )}

            {product.dangerWarnings && (
              <View style={styles.dangerBanner}>
                <Text style={styles.dangerText}>{product.dangerWarnings}</Text>
              </View>
            )}

            {product.manufacturer && (
              <Text style={styles.metaText}>Manufacturer: {product.manufacturer}</Text>
            )}
            {product.countryOfOrigin && (
              <Text style={styles.metaText}>Origin: {product.countryOfOrigin}</Text>
            )}
          </View>
        )}

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Related Products</Text>
            <FlatList
              horizontal
              data={relatedProducts}
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => (
                <View style={styles.relatedCard}>
                  <ProductCard
                    item={item}
                    onAddToCart={handleAddToCart}
                    onUpdateQuantity={updateQuantity}
                    quantity={cartQuantityMap.get(item.id) ?? 0}
                    storeId={storeId}
                  />
                </View>
              )}
            />
          </View>
        )}
      </View>
      <FloatingCart />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { fontSize: fontSize.lg, color: colors.textSecondary },
  heroImage: { width: SCREEN_WIDTH, height: 280 },
  heroPlaceholder: { backgroundColor: "#f0f0f0", justifyContent: "center", alignItems: "center" },
  heroPlaceholderText: { fontSize: fontSize.lg, color: colors.textSecondary },
  dotRow: { flexDirection: "row", justifyContent: "center", paddingVertical: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border, marginHorizontal: 3 },
  dotActive: { backgroundColor: colors.primary, width: 10, height: 10, borderRadius: 5 },
  body: { padding: spacing.md },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.xs },
  foodTypeDot: {
    width: 18, height: 18, borderWidth: 1.5, borderRadius: 3,
    justifyContent: "center", alignItems: "center",
  },
  foodTypeVeg: { borderColor: "#0a8f08" },
  foodTypeNonVeg: { borderColor: "#b71c1c" },
  foodTypeDotInner: { width: 9, height: 9, borderRadius: 5 },
  foodTypeDotVeg: { backgroundColor: "#0a8f08" },
  foodTypeDotNonVeg: { backgroundColor: "#b71c1c" },
  brandName: { fontSize: fontSize.sm, fontWeight: "600", color: colors.textSecondary, textTransform: "uppercase" },
  productName: { fontSize: fontSize.xxl, fontWeight: "bold", color: colors.text, marginBottom: spacing.xs },
  categoryChip: {
    backgroundColor: colors.primary + "15",
    borderRadius: 12,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    alignSelf: "flex-start",
    marginBottom: spacing.sm,
  },
  categoryChipText: { fontSize: fontSize.sm, color: colors.primary, fontWeight: "600" },
  section: { marginTop: spacing.lg },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: "bold", color: colors.text, marginBottom: spacing.sm },
  descText: { fontSize: fontSize.md, color: colors.textSecondary, lineHeight: 22 },
  readMore: { color: colors.primary, fontWeight: "600", marginTop: spacing.xs },
  variantCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  variantInfo: { flex: 1 },
  variantName: { fontSize: fontSize.md, fontWeight: "600", color: colors.text },
  variantUnit: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.xs },
  mrpPrice: { fontSize: fontSize.sm, color: colors.textSecondary, textDecorationLine: "line-through" },
  price: { fontSize: fontSize.lg, fontWeight: "bold", color: colors.primary },
  outOfStock: { fontSize: fontSize.sm, color: colors.error, fontWeight: "600", marginTop: 2 },
  variantAddBtn: {
    backgroundColor: colors.primary,
    borderRadius: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  disabledBtn: { backgroundColor: colors.border },
  variantAddText: { color: "#fff", fontSize: fontSize.sm, fontWeight: "600" },
  disabledText: { color: colors.textSecondary },
  variantQtyStepper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 6,
    backgroundColor: colors.primary + "08",
    overflow: "hidden",
  },
  variantQtyBtn: {
    paddingHorizontal: 10,
    paddingVertical: spacing.sm,
    justifyContent: "center",
    alignItems: "center",
  },
  variantQtyText: {
    fontSize: fontSize.md,
    fontWeight: "700",
    color: colors.primary,
    minWidth: 24,
    textAlign: "center",
  },
  hintBox: {
    backgroundColor: colors.secondary + "15",
    borderRadius: 8,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  hintText: { fontSize: fontSize.md, color: colors.secondary, textAlign: "center" },
  table: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  tableRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableKey: { fontSize: fontSize.md, color: colors.text, fontWeight: "500", flex: 1 },
  tableValue: { fontSize: fontSize.md, color: colors.textSecondary, flex: 1, textAlign: "right" },
  bodyText: { fontSize: fontSize.md, color: colors.textSecondary, lineHeight: 22 },
  allergenBadge: {
    backgroundColor: "#fef3c7",
    borderRadius: 6,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: "#f59e0b",
  },
  allergenText: { fontSize: fontSize.md, color: "#92400e" },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  regBadge: { backgroundColor: "#e6f0ff", borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
  regBadgeText: { fontSize: fontSize.sm, color: "#1a56db", fontWeight: "600" },
  certBadge: { backgroundColor: "#e6f9e6", borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
  certBadgeText: { fontSize: fontSize.sm, color: "#166534", fontWeight: "600" },
  dangerBanner: {
    backgroundColor: "#fef3c7",
    borderRadius: 6,
    padding: spacing.sm,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: "#f59e0b",
  },
  dangerText: { fontSize: fontSize.sm, color: "#92400e" },
  metaText: { fontSize: fontSize.md, color: colors.textSecondary, marginTop: spacing.xs },
  relatedCard: { width: 280, marginRight: spacing.sm },
});
