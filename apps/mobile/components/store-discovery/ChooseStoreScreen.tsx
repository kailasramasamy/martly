import { useLayoutEffect, useMemo, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { router, useNavigation } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../constants/theme";
import { useStore } from "../../lib/store-context";
import type { Store } from "../../lib/types";
import { StoreBrowser } from "./StoreBrowser";
import { ChooseStoreButton } from "./ChooseStoreButton";
import { useOfferTap } from "./use-offer-tap";

/** All stores with what we know about them from here: nearby ones that deliver first, fastest first */
function useStoreChoices(search: string): Store[] {
  const { stores, nearbyStores } = useStore();
  return useMemo(() => {
    const near = new Map(nearbyStores.map((s) => [s.id, s]));
    const rank = (s: Store) => (s.deliversToYou ? 0 : s.distance != null ? 1 : 2);
    const all = stores.filter((s) => s.status === "ACTIVE").map((s) => near.get(s.id) ?? s)
      .sort((a, b) => rank(a) - rank(b) || (a.expressEtaMinutes ?? Infinity) - (b.expressEtaMinutes ?? Infinity) || (a.distance ?? 0) - (b.distance ?? 0));
    const q = search.trim().toLowerCase();
    return q ? all.filter((s) => [s.name, s.address, s.tagline ?? "", ...(s.highlights ?? [])].some((t) => t.toLowerCase().includes(q))) : all;
  }, [stores, nearbyStores, search]);
}

function SearchBar({ value, onChange }: { value: string; onChange: (q: string) => void }) {
  return (
    <View style={styles.searchWrap}>
      <Ionicons name="search-outline" size={18} color="#94a3b8" />
      <TextInput style={styles.searchInput} placeholder="Search stores, areas or specialities" value={value} onChangeText={onChange}
        autoFocus autoCapitalize="none" autoCorrect={false} placeholderTextColor="#94a3b8" />
      {value.length > 0 && (
        <TouchableOpacity onPress={() => onChange("")} hitSlop={12} accessibilityLabel="Clear search">
          <Ionicons name="close-circle" size={18} color="#cbd5e1" />
        </TouchableOpacity>
      )}
    </View>
  );
}

/** Search lives behind an icon in the header so the store panel gets the room */
function useHeaderSearch() {
  const navigation = useNavigation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={() => { setOpen((o) => !o); setSearch(""); }} style={styles.headerIcon} accessibilityLabel={open ? "Close search" : "Search stores"}>
          <Ionicons name={open ? "close" : "search"} size={22} color={colors.text} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, open]);
  return { open, search, setSearch };
}

/** Full-screen store chooser: tiles to compare, the previewed store in full, and a button to shop there */
export function ChooseStoreScreen() {
  const { selectedStore, setSelectedStore } = useStore();
  const insets = useSafeAreaInsets();
  const { open, search, setSearch } = useHeaderSearch();
  const [previewId, setPreviewId] = useState<string | null>(selectedStore?.id ?? null);
  const choices = useStoreChoices(search);
  const preview = choices.find((s) => s.id === previewId) ?? choices[0];

  const switchTo = (store: Store) => { if (store.id !== selectedStore?.id) setSelectedStore(store); };
  const choose = (store: Store) => { switchTo(store); router.back(); };
  const tapOffer = useOfferTap(selectedStore, switchTo);

  return (
    <View style={styles.container}>
      {open && <View style={styles.searchBox}><SearchBar value={search} onChange={setSearch} /></View>}
      <ScrollView contentContainerStyle={styles.body} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
        {choices.length > 0 ? (
          <StoreBrowser stores={choices} activeId={preview?.id ?? null} onPreview={(s) => setPreviewId(s.id)} isMuted={() => false} inset={16} onBannerPress={tapOffer} />
        ) : (
          <View style={styles.empty}>
            <Ionicons name="search" size={28} color="#94a3b8" />
            <Text style={styles.emptyTitle}>No stores found</Text>
            <Text style={styles.emptyText}>Try a different search term</Text>
          </View>
        )}
        <View style={styles.everywhere}>
          <Ionicons name="shield-checkmark-outline" size={15} color={colors.primary} />
          <Text style={styles.everywhereText}>Every store: pay online, or cash/UPI on delivery · free pickup from the store</Text>
        </View>
      </ScrollView>
      {preview && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 10 }]}>
          <ChooseStoreButton store={preview} current={preview.id === selectedStore?.id} onChoose={choose} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  headerIcon: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  searchBox: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  body: { padding: 16, paddingBottom: 24 },
  footer: { paddingHorizontal: 16, paddingTop: 10, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#f1f5f9" },
  everywhere: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14, padding: 10, borderRadius: 12, backgroundColor: "#f0fdfa" },
  everywhereText: { flex: 1, fontFamily: fonts.semibold, fontSize: 12.5, lineHeight: 17, color: colors.primary },
  searchWrap: {
    flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, paddingHorizontal: 12,
  },
  searchInput: { flex: 1, paddingVertical: 11, fontSize: 14, color: colors.text },
  empty: { alignItems: "center", paddingTop: 48 },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.text, marginTop: 8 },
  emptyText: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: 4 },
});
