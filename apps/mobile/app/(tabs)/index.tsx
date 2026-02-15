import { useEffect, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { api } from "../../lib/api";
import { colors, spacing, fontSize } from "../../constants/theme";

interface Store {
  id: string;
  name: string;
  address: string;
  status: string;
}

export default function HomeScreen() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getList<Store>("/api/v1/stores")
      .then((res) => setStores(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Stores Near You</Text>
      <FlatList
        data={stores}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => router.push(`/store/${item.id}`)}>
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text style={styles.cardSubtitle}>{item.address}</Text>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No stores found</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: spacing.md },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: fontSize.xl, fontWeight: "bold", color: colors.text, paddingHorizontal: spacing.md, marginBottom: spacing.md },
  list: { paddingHorizontal: spacing.md },
  card: {
    backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md,
    marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border,
  },
  cardTitle: { fontSize: fontSize.lg, fontWeight: "600", color: colors.text },
  cardSubtitle: { fontSize: fontSize.md, color: colors.textSecondary, marginTop: spacing.xs },
  empty: { textAlign: "center", color: colors.textSecondary, marginTop: spacing.xl },
});
