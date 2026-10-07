import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../constants/theme";

interface Props {
  title: string;
  imageUrl?: string | null;
  fallbackIcon: keyof typeof Ionicons.glyphMap;
  size: number;
  onPress: () => void;
}

export function CategoryTile({ title, imageUrl, fallbackIcon, size, onPress }: Props) {
  return (
    <Pressable
      style={({ pressed }) => [{ width: size }, styles.tile, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={[styles.imageWrap, { width: size, height: size, borderRadius: size * 0.22 }]}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
        ) : (
          <Ionicons name={fallbackIcon} size={size * 0.34} color={colors.primary} />
        )}
      </View>
      <Text style={styles.label} numberOfLines={2}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: "center" },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  imageWrap: {
    overflow: "hidden",
    backgroundColor: "#f0fdfa",
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  image: { width: "100%", height: "100%" },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 16,
    color: colors.text,
    textAlign: "center",
    marginTop: 6,
  },
});
