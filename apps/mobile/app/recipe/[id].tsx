import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../lib/api";
import { useStore } from "../../lib/store-context";
import { useCart } from "../../lib/cart-context";
import { useToast } from "../../lib/toast-context";
import type { RecipeDetail, RecipeIngredient } from "../../lib/types";
import { colors } from "../../constants/theme";

const DIFFICULTY_COLORS: Record<string, string> = {
  EASY: "#16a34a",
  MEDIUM: "#d97706",
  HARD: "#dc2626",
};

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { selectedStore } = useStore();
  const storeId = selectedStore?.id;
  const storeName = selectedStore?.name ?? "";
  const cart = useCart();
  const toast = useToast();
  const insets = useSafeAreaInsets();

  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!storeId || !id) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await api.get<RecipeDetail>(`/api/v1/recipes/stores/${storeId}/${id}`);
        const data = res.data;
        if (data) {
          setRecipe(data);
          // Check all available items by default
          const availableIds = new Set<string>();
          for (const item of data.items) {
            if (item.available) availableIds.add(item.id);
          }
          setChecked(availableIds);
        }
      } catch {
        // error
      } finally {
        setLoading(false);
      }
    })();
  }, [storeId, id]);

  const toggleItem = useCallback((itemId: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }, []);

  const checkedAvailable = recipe
    ? recipe.items.filter((item) => item.available && checked.has(item.id))
    : [];
  const totalPrice = checkedAvailable.reduce(
    (sum, item) =>
      sum + (item.storeProduct?.pricing?.effectivePrice ?? Number(item.storeProduct?.price ?? 0)),
    0,
  );

  const handleAddToCart = useCallback(() => {
    if (!storeId || !recipe || checkedAvailable.length === 0) return;

    // Check if cart has items from a different store
    if (cart.storeId && cart.storeId !== storeId && cart.items.length > 0) {
      Alert.alert(
        "Switch Store?",
        `Your cart has items from ${cart.storeName}. Adding from ${storeName} will clear existing items.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Switch & Add",
            style: "destructive",
            onPress: () => addItems(true),
          },
        ],
      );
      return;
    }

    addItems(false);
  }, [storeId, recipe, checkedAvailable, cart, storeName]);

  const addItems = (clearFirst: boolean) => {
    if (!storeId) return;
    setAdding(true);

    if (clearFirst) {
      cart.clearCart();
    }

    let addedCount = 0;
    for (const item of checkedAvailable) {
      if (!item.storeProduct) continue;
      const sp = item.storeProduct;
      cart.addItem(storeId, storeName, {
        storeProductId: sp.id,
        productId: item.product.id,
        productName: item.product.name,
        variantId: sp.variant?.id ?? sp.variantId,
        variantName: sp.variant?.name ?? "",
        price: sp.pricing?.effectivePrice ?? Number(sp.price),
        imageUrl: item.product.imageUrl,
      });
      addedCount++;
    }

    setAdding(false);
    toast.show(`Added ${addedCount} items to cart`, "success");
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!recipe) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Recipe not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Hero Image */}
        {recipe.imageUrl ? (
          <Image source={{ uri: recipe.imageUrl }} style={styles.heroImage} resizeMode="cover" />
        ) : (
          <View style={[styles.heroImage, styles.heroPlaceholder]}>
            <Ionicons name="restaurant-outline" size={48} color="#94a3b8" />
          </View>
        )}

        {/* Title & Description */}
        <View style={styles.header}>
          <Text style={styles.title}>{recipe.title}</Text>
          {recipe.description && (
            <Text style={styles.description}>{recipe.description}</Text>
          )}
        </View>

        {/* Metadata row */}
        <View style={styles.metaRow}>
          {recipe.prepTime && (
            <MetaChip icon="time-outline" label={`${recipe.prepTime}m prep`} />
          )}
          {recipe.cookTime && (
            <MetaChip icon="flame-outline" label={`${recipe.cookTime}m cook`} />
          )}
          {recipe.servings && (
            <MetaChip icon="people-outline" label={`${recipe.servings} servings`} />
          )}
          {recipe.difficulty && (
            <View style={[styles.metaChip, { borderColor: DIFFICULTY_COLORS[recipe.difficulty] + "40" }]}>
              <View style={[styles.diffDot, { backgroundColor: DIFFICULTY_COLORS[recipe.difficulty] }]} />
              <Text style={[styles.metaChipText, { color: DIFFICULTY_COLORS[recipe.difficulty] }]}>
                {recipe.difficulty.charAt(0) + recipe.difficulty.slice(1).toLowerCase()}
              </Text>
            </View>
          )}
          {recipe.cuisineType && (
            <MetaChip icon="globe-outline" label={recipe.cuisineType} />
          )}
        </View>

        {/* Ingredients */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Ingredients ({recipe.items.length})
          </Text>
          {recipe.items.map((item) => (
            <IngredientRow
              key={item.id}
              item={item}
              isChecked={checked.has(item.id)}
              onToggle={() => toggleItem(item.id)}
              storeId={storeId}
            />
          ))}
        </View>

        {/* Instructions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Instructions</Text>
          {(recipe.instructions as string[]).map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{i + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Floating bottom bar */}
      {checkedAvailable.length > 0 && (
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity
            style={styles.addButton}
            activeOpacity={0.85}
            onPress={handleAddToCart}
            disabled={adding}
          >
            {adding ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.addButtonText}>
                Add {checkedAvailable.length} items — {"\u20B9"}{Math.round(totalPrice)}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function MetaChip({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.metaChip}>
      <Ionicons name={icon} size={14} color="#64748b" />
      <Text style={styles.metaChipText}>{label}</Text>
    </View>
  );
}

function IngredientRow({
  item,
  isChecked,
  onToggle,
  storeId,
}: {
  item: RecipeIngredient;
  isChecked: boolean;
  onToggle: () => void;
  storeId: string | undefined;
}) {
  const router = useRouter();
  const unavailable = !item.available;
  const price = item.storeProduct?.pricing?.effectivePrice ?? Number(item.storeProduct?.price ?? 0);

  return (
    <View style={[styles.ingredientRow, unavailable && styles.ingredientUnavailable]}>
      <TouchableOpacity
        style={styles.checkboxTouchable}
        activeOpacity={0.7}
        onPress={onToggle}
        disabled={unavailable}
      >
        <View style={[styles.checkbox, isChecked && styles.checkboxChecked, unavailable && styles.checkboxDisabled]}>
          {isChecked && <Ionicons name="checkmark" size={14} color="#fff" />}
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.ingredientTouchable}
        activeOpacity={0.7}
        onPress={() => router.push({ pathname: "/product/[id]", params: { id: item.product.id, storeId: storeId ?? "" } })}
      >
        {item.product.imageUrl ? (
          <Image source={{ uri: item.product.imageUrl }} style={styles.ingredientImage} />
        ) : (
          <View style={[styles.ingredientImage, styles.ingredientPlaceholder]}>
            <Ionicons name="leaf-outline" size={16} color="#94a3b8" />
          </View>
        )}
        <View style={styles.ingredientInfo}>
          <Text style={[styles.ingredientName, unavailable && styles.textMuted]} numberOfLines={1}>
            {item.product.name}
          </Text>
          <View style={styles.ingredientMeta}>
            <Text style={styles.ingredientQty}>{item.displayQty}</Text>
            {item.note && <Text style={styles.ingredientNote}> · {item.note}</Text>}
          </View>
        </View>
        <View style={styles.ingredientRight}>
          {unavailable ? (
            <Text style={styles.unavailableLabel}>Unavailable</Text>
          ) : (
            <Text style={styles.ingredientPrice}>{"\u20B9"}{Math.round(price)}</Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={14} color="#94a3b8" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
  },
  errorText: {
    fontSize: 16,
    color: "#64748b",
  },
  heroImage: {
    width: "100%",
    height: 220,
  },
  heroPlaceholder: {
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    padding: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0f172a",
  },
  description: {
    fontSize: 14,
    color: "#64748b",
    lineHeight: 20,
    marginTop: 6,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  metaChipText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#64748b",
  },
  diffDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 12,
  },
  ingredientRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  checkboxTouchable: {
    paddingRight: 10,
    paddingVertical: 4,
  },
  ingredientTouchable: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  ingredientUnavailable: {
    opacity: 0.5,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#cbd5e1",
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxDisabled: {
    borderColor: "#e2e8f0",
    backgroundColor: "#f1f5f9",
  },
  ingredientImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  ingredientPlaceholder: {
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
  },
  ingredientInfo: {
    flex: 1,
  },
  ingredientName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
  },
  ingredientMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  ingredientQty: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "500",
  },
  ingredientNote: {
    fontSize: 12,
    color: "#94a3b8",
    fontStyle: "italic",
  },
  textMuted: {
    color: "#94a3b8",
  },
  ingredientRight: {
    alignItems: "flex-end",
  },
  ingredientPrice: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primary,
  },
  unavailableLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#ef4444",
  },
  stepRow: {
    flexDirection: "row",
    marginBottom: 14,
    gap: 12,
  },
  stepNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  stepNumberText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: "#374151",
    lineHeight: 21,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: "#e2e8f0",
  },
  addButton: {
    backgroundColor: colors.primary,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
});
