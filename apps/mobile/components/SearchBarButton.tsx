import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, Animated, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../constants/theme";

const SUGGESTIONS = ["milk", "atta", "onion", "eggs", "bread", "paneer", "chips", "detergent"];
const ROTATE_MS = 2600;

export function SearchBarButton() {
  const [index, setIndex] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const timer = setInterval(() => {
      Animated.timing(fade, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
        setIndex((i) => (i + 1) % SUGGESTIONS.length);
        Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }).start();
      });
    }, ROTATE_MS);
    return () => clearInterval(timer);
  }, [fade]);

  return (
    <View style={styles.bar}>
      <Pressable
        style={styles.searchArea}
        onPress={() => router.push("/search")}
        accessibilityRole="search"
        accessibilityLabel="Search groceries and brands"
      >
        <Ionicons name="search-outline" size={18} color={colors.textSecondary} />
        <Text style={styles.placeholder} numberOfLines={1}>
          Search for{" "}
          <Animated.Text style={[styles.suggestion, { opacity: fade }]}>{`"${SUGGESTIONS[index]}"`}</Animated.Text>
        </Text>
      </Pressable>
      <View style={styles.divider} />
      <Pressable
        style={({ pressed }) => [styles.mic, pressed && { opacity: 0.6 }]}
        onPress={() => router.push({ pathname: "/ai-order", params: { voice: "1" } })}
        accessibilityRole="button"
        accessibilityLabel="Order by voice"
        hitSlop={6}
      >
        <Ionicons name="mic-outline" size={20} color={colors.primary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row", alignItems: "center", height: 46,
    backgroundColor: "#f1f5f9", borderRadius: 12, paddingLeft: 14,
  },
  searchArea: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, height: "100%" },
  placeholder: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: "#94a3b8" },
  suggestion: { fontFamily: fonts.semibold, color: colors.textSecondary },
  divider: { width: 1, height: 22, backgroundColor: colors.border },
  mic: { width: 48, height: "100%", alignItems: "center", justifyContent: "center" },
});
