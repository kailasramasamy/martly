import { useEffect, useState } from "react";
import { FlatList, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../constants/theme";
import { api, ApiError } from "../../lib/api";
import { groupByProduct } from "../../lib/group-variants";
import { useLanguage } from "../../lib/language-context";
import { getBestPrice, useMembership } from "../../lib/membership-context";
import { useStrings } from "../../lib/i18n/use-strings";
import type { StoreProduct } from "../../lib/types";
import { Loader } from "../Loader";
import { BottomSheet } from "../search/BottomSheet";

const MIN_QUERY = 2;
const TYPING_DELAY_MS = 350;
const MAX_PRODUCTS = 20;

type Results = { kind: "idle" } | { kind: "loading" } | { kind: "failed" } | { kind: "ready"; products: StoreProduct[][] };

// The store's products for the query, each with its in-stock sizes smallest price first; searched once typing pauses
function useProductSearch(storeId: string, query: string) {
  const [results, setResults] = useState<Results>({ kind: "idle" });
  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_QUERY) return setResults({ kind: "idle" });
    let live = true;
    setResults({ kind: "loading" });
    const timer = setTimeout(() => {
      api.get<StoreProduct[]>(`/api/v1/stores/${storeId}/products?q=${encodeURIComponent(q)}`)
        .then((res) => {
          if (!live) return;
          const { primary, variantsByProductId } = groupByProduct(res.data.filter((sp) => sp.availableStock > 0));
          setResults({ kind: "ready", products: primary.slice(0, MAX_PRODUCTS).map((p) => variantsByProductId.get(p.product.id)!) });
        })
        .catch((err) => {
          if (!(err instanceof ApiError || err instanceof TypeError)) throw err;
          if (live) setResults({ kind: "failed" });
        });
    }, TYPING_DELAY_MS);
    return () => { live = false; clearTimeout(timer); };
  }, [storeId, query]);
  return results;
}

// A product with a chip per size: tapping one puts that size on the list; sizes already there show ticked
function ProductRow({ sizes, onList, onAdd }: { sizes: StoreProduct[]; onList: Set<string>; onAdd: (sp: StoreProduct) => void }) {
  const { getLocalizedName } = useLanguage();
  const { isMember } = useMembership();
  const first = sizes[0];
  const image = first.product.imageUrl ?? first.variant.imageUrl;
  return (
    <View style={styles.product}>
      <View style={styles.thumb}>{image && <Image source={{ uri: image }} style={styles.thumbImg} />}</View>
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={2}>{getLocalizedName(first.product)}</Text>
        <View style={styles.chips}>
          {sizes.map((sp) => {
            const on = onList.has(sp.variantId);
            return (
              <TouchableOpacity
                key={sp.id} style={[styles.chip, on && styles.chipOn]} disabled={on} onPress={() => onAdd(sp)}
                accessibilityRole="button" accessibilityState={{ selected: on }}
              >
                <Ionicons name={on ? "checkmark" : "add"} size={14} color={on ? "#ffffff" : colors.primary} />
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{`${sp.variant.name} · ₹${Math.round(getBestPrice(sp, isMember))}`}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

interface Props {
  visible: boolean;
  storeId: string;
  /** Variants already on the list */
  onList: Set<string>;
  onAdd: (sp: StoreProduct) => void;
  onClose: () => void;
}

/** Search the store and put something new on the list, in the size wanted */
export function AddItemSheet({ visible, storeId, onList, onAdd, onClose }: Props) {
  const t = useStrings("monthlyList");
  const [query, setQuery] = useState("");
  const results = useProductSearch(storeId, query);
  const close = () => { setQuery(""); onClose(); };
  return (
    <BottomSheet visible={visible} title={t.addTitle} onClose={close} flush>
      <View style={styles.search}>
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <TextInput
          style={styles.input} value={query} onChangeText={setQuery} placeholder={t.addPlaceholder}
          placeholderTextColor="#94a3b8" autoFocus returnKeyType="search" autoCorrect={false}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery("")} hitSlop={12} accessibilityLabel={t.clearSearch}>
            <Ionicons name="close-circle" size={18} color="#94a3b8" />
          </TouchableOpacity>
        )}
      </View>
      {results.kind === "idle" && <Text style={styles.status}>{t.addHint}</Text>}
      {results.kind === "loading" && <Loader style={styles.loader} />}
      {results.kind === "failed" && <Text style={styles.status}>{t.loadFailed}</Text>}
      {results.kind === "ready" && results.products.length === 0 && <Text style={styles.status}>{t.noResults(query.trim())}</Text>}
      {results.kind === "ready" && (
        <FlatList
          data={results.products} keyExtractor={(sizes) => sizes[0].product.id} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
          renderItem={({ item }) => <ProductRow sizes={item} onList={onList} onAdd={onAdd} />}
        />
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: "row", alignItems: "center", gap: 8, height: 48, marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  input: { flex: 1, height: 46, fontFamily: fonts.medium, fontSize: 15, color: colors.text },
  status: { marginVertical: 28, marginHorizontal: 24, fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: colors.textSecondary, textAlign: "center" },
  loader: { marginVertical: 28 },
  product: { flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  thumb: { width: 52, height: 52, borderRadius: 10, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  thumbImg: { width: 46, height: 46, resizeMode: "contain" },
  productInfo: { flex: 1, minWidth: 0, gap: 8 },
  productName: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 19, color: colors.text },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, height: 34, paddingHorizontal: 10, borderRadius: 17, borderWidth: 1.5, borderColor: colors.primary },
  chipOn: { backgroundColor: colors.primary },
  chipText: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.primary },
  chipTextOn: { color: "#ffffff" },
});
