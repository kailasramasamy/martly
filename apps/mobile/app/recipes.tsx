import { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  Keyboard,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../lib/api";
import { useStore } from "../lib/store-context";
import { RecipeCard } from "../components/RecipeCard";
import type { RecipeSummary } from "../lib/types";

const DIFFICULTY_OPTIONS = ["EASY", "MEDIUM", "HARD"];
const DIET_OPTIONS = [
  { value: "VEG", label: "Veg" },
  { value: "NON_VEG", label: "Non-Veg" },
  { value: "EGG", label: "Egg" },
];

export default function RecipesScreen() {
  const { selectedStore } = useStore();
  const storeId = selectedStore?.id;

  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [difficulty, setDifficulty] = useState<string | null>(null);
  const [dietType, setDietType] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  const initialLoad = useRef(true);

  const fetchRecipes = useCallback(async () => {
    if (!storeId) {
      setLoading(false);
      return;
    }
    try {
      const params = new URLSearchParams();
      params.set("pageSize", "50");
      if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim());
      if (difficulty) params.set("difficulty", difficulty);
      if (dietType) params.set("dietType", dietType);
      const res = await api.get<RecipeSummary[]>(`/api/v1/recipes/stores/${storeId}?${params}`);
      setRecipes(res.data ?? []);
    } catch {
      setRecipes([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
      initialLoad.current = false;
    }
  }, [storeId, debouncedSearch, difficulty, dietType]);

  useEffect(() => {
    if (initialLoad.current) setLoading(true);
    fetchRecipes();
  }, [fetchRecipes]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchRecipes();
  };

  if (loading && initialLoad.current) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0d9488" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={recipes}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={() => Keyboard.dismiss()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0d9488" />}
        ListHeaderComponent={
          <>
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={16} color="#94a3b8" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search recipes..."
                placeholderTextColor="#94a3b8"
                value={search}
                onChangeText={setSearch}
                returnKeyType="search"
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch("")} hitSlop={8}>
                  <Ionicons name="close-circle" size={16} color="#94a3b8" />
                </TouchableOpacity>
              )}
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            >
              {DIFFICULTY_OPTIONS.map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[styles.chip, difficulty === d && styles.chipActive]}
                  onPress={() => setDifficulty(difficulty === d ? null : d)}
                >
                  <Text style={[styles.chipText, difficulty === d && styles.chipTextActive]}>
                    {d.charAt(0) + d.slice(1).toLowerCase()}
                  </Text>
                </TouchableOpacity>
              ))}
              <View style={styles.chipDivider} />
              {DIET_OPTIONS.map((dt) => (
                <TouchableOpacity
                  key={dt.value}
                  style={[styles.chip, dietType === dt.value && styles.chipActive]}
                  onPress={() => setDietType(dietType === dt.value ? null : dt.value)}
                >
                  <Text style={[styles.chipText, dietType === dt.value && styles.chipTextActive]}>
                    {dt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        }
        renderItem={({ item }) => (
          <View style={styles.gridItem}>
            <RecipeCard recipe={item} />
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No recipes found</Text>
            <Text style={styles.emptySubtitle}>Try changing your filters</Text>
          </View>
        }
      />
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
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 12,
    height: 40,
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#0f172a",
    paddingVertical: 0,
  },
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
    gap: 8,
    alignItems: "center",
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  chipActive: {
    backgroundColor: "#0d9488",
    borderColor: "#0d9488",
  },
  chipText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#64748b",
  },
  chipTextActive: {
    color: "#fff",
  },
  chipDivider: {
    width: 1,
    height: 20,
    backgroundColor: "#e2e8f0",
  },
  list: {
    paddingBottom: 16,
  },
  row: {
    gap: 12,
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  gridItem: {
    flex: 1,
    maxWidth: "50%",
  },
  empty: {
    alignItems: "center",
    paddingTop: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0f172a",
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#94a3b8",
    marginTop: 4,
  },
});
