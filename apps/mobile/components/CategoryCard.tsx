import { View, Text, TouchableOpacity, Image, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../constants/theme";
import { getCategoryIcon } from "../constants/category-icons";

interface CategoryCardProps {
  id: string;
  name: string;
  imageUrl: string | null;
  onPress: (id: string) => void;
}

// Muted pastel backgrounds for categories without images
const CATEGORY_COLORS = [
  { bg: "#dcfce7", text: "#16a34a" },
  { bg: "#dbeafe", text: "#2563eb" },
  { bg: "#fef3c7", text: "#d97706" },
  { bg: "#fce7f3", text: "#db2777" },
  { bg: "#ede9fe", text: "#7c3aed" },
  { bg: "#ffedd5", text: "#ea580c" },
  { bg: "#e0f2fe", text: "#0284c7" },
  { bg: "#fee2e2", text: "#dc2626" },
];

function getColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return CATEGORY_COLORS[Math.abs(hash) % CATEGORY_COLORS.length];
}

export function CategoryCard({ id, name, imageUrl, onPress }: CategoryCardProps) {
  const palette = getColor(id);

  return (
    <TouchableOpacity style={styles.container} onPress={() => onPress(id)} activeOpacity={0.7}>
      {imageUrl ? (
        <View style={styles.imageWrap}>
          <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
        </View>
      ) : (
        <View style={[styles.iconBox, { backgroundColor: palette.bg }]}>
          <Ionicons name={getCategoryIcon(name)} size={26} color={palette.text} />
        </View>
      )}
      <Text style={styles.name} numberOfLines={2}>{name}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    width: 72,
  },
  imageWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#f1f5f9",
  },
  image: {
    width: 56,
    height: 56,
  },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  name: {
    fontSize: 11,
    fontWeight: "500",
    color: colors.text,
    textAlign: "center",
    lineHeight: 14,
    marginTop: 6,
  },
});
