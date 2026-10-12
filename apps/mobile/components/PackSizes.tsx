import { useEffect, useRef } from "react";
import { View, Text, Pressable, Image, ScrollView, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { colors, fonts } from "../constants/theme";
import type { StoreProduct } from "../lib/types";

// Narrow rail cards fit two size chips on the photo, grid cards three
export const maxChips = (cardWidth: number) => (cardWidth < 140 ? 2 : 3);

// The list's primary size shows the product's hero shot; other sizes their own pack shot when they have one
export const sizeImage = (sp: StoreProduct, primaryId: string) =>
  sp.id === primaryId ? sp.product.imageUrl || sp.variant.imageUrl : sp.variant.imageUrl || sp.product.imageUrl;

// One page per size: swiping the photo switches size, and a chip tap scrolls the photo to its size
export function SizePager({ sizes, primaryId, index, width, onIndex, onPress }: {
  sizes: StoreProduct[]; primaryId: string; index: number; width: number; onIndex: (i: number) => void; onPress: () => void;
}) {
  const ref = useRef<ScrollView>(null);
  const shown = useRef(index);
  useEffect(() => {
    if (shown.current === index) return;
    shown.current = index;
    ref.current?.scrollTo({ x: index * width, animated: true });
  }, [index, width]);
  return (
    <ScrollView
      ref={ref}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      contentOffset={{ x: index * width, y: 0 }}
      onMomentumScrollEnd={(e) => {
        const i = Math.round(e.nativeEvent.contentOffset.x / width);
        shown.current = i;
        if (i !== index) onIndex(i);
      }}
    >
      {sizes.map((s) => {
        const uri = sizeImage(s, primaryId);
        return (
          <Pressable key={s.id} style={{ width, height: "100%" }} onPress={onPress} accessibilityLabel={`${s.variant.name} pack, swipe for other sizes`}>
            {uri && <Image source={{ uri }} style={styles.image} resizeMode="contain" />}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// Every size at a glance, on the photo itself: tap to switch the card to that pack. Sizes that don't fit
// collapse into "+N", which opens the size sheet; a size beyond them (reached by swiping) takes the last slot
export function SizeChips({ sizes, selectedId, maxChips, onSelect, onMore, style }: {
  sizes: StoreProduct[]; selectedId: string; maxChips: number; onSelect: (id: string) => void; onMore?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const overflow = sizes.length > maxChips;
  const room = overflow ? maxChips - 1 : maxChips;
  let shown = sizes.slice(0, room);
  if (!shown.some((s) => s.id === selectedId)) shown = [...shown.slice(0, room - 1), sizes.find((s) => s.id === selectedId)!];
  return (
    <View style={[styles.chips, style]}>
      {shown.map((s) => {
        const active = s.id === selectedId;
        return (
          <Pressable
            key={s.id}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onSelect(s.id)}
            hitSlop={{ top: 10, bottom: 8, left: 2, right: 2 }}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${s.variant.name} pack`}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>{s.variant.name}</Text>
          </Pressable>
        );
      })}
      {overflow && (
        <Pressable style={styles.chip} onPress={onMore} hitSlop={{ top: 10, bottom: 8, left: 2, right: 2 }} accessibilityLabel={`${sizes.length - room} more sizes`}>
          <Text style={styles.chipText}>+{sizes.length - shown.length}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  image: { width: "100%", height: "100%", mixBlendMode: "multiply" },
  chips: {
    position: "absolute", right: 5, bottom: 5, flexDirection: "row", gap: 3, padding: 2,
    borderRadius: 9, backgroundColor: "rgba(255,255,255,0.94)",
    shadowColor: "#0f172a", shadowOpacity: 0.12, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2,
  },
  chip: { minWidth: 26, height: 22, paddingHorizontal: 6, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontFamily: fonts.bold, fontSize: 10.5, color: colors.text },
  chipTextActive: { color: "#fff" },
});
