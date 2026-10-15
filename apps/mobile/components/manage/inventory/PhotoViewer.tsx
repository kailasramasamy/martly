import { useEffect, useState } from "react";
import { Modal, View, ScrollView, Image, TouchableOpacity, Text, StyleSheet, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fonts } from "../../../constants/theme";
import { tabular } from "../ui/tokens";
import { PhotoDots } from "./PhotoSwiper";

interface PhotoViewerProps {
  photos: string[];
  /** Photo to open at; null keeps the viewer closed */
  index: number | null;
  onClose: () => void;
}

/** Full-screen photo viewer: swipe between photos, pinch or double-tap to zoom (iOS) */
export function PhotoViewer({ photos, index, onClose }: PhotoViewerProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState(index ?? 0);
  useEffect(() => { if (index !== null) setCurrent(index); }, [index]);

  return (
    <Modal visible={index !== null} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: (index ?? 0) * width, y: 0 }}
          onMomentumScrollEnd={(e) => setCurrent(Math.round(e.nativeEvent.contentOffset.x / width))}
        >
          {photos.map((uri, i) => (
            <ScrollView
              key={`${uri}-${i}`}
              style={{ width, height }}
              contentContainerStyle={styles.page}
              maximumZoomScale={4}
              centerContent
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
            >
              <Image source={{ uri }} style={{ width, height: height * 0.75 }} resizeMode="contain" />
            </ScrollView>
          ))}
        </ScrollView>
        <TouchableOpacity style={[styles.close, { top: insets.top + 8 }]} onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close photo">
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={[styles.footer, { bottom: insets.bottom + 16 }]} pointerEvents="none">
          {photos.length > 1 && <Text style={[styles.counter, tabular]}>{current + 1} / {photos.length}</Text>}
          <PhotoDots count={photos.length} index={current} dark />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "#000" },
  page: { flexGrow: 1, alignItems: "center", justifyContent: "center" },
  close: {
    position: "absolute", right: 16, width: 44, height: 44, borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center",
  },
  footer: { position: "absolute", left: 0, right: 0, alignItems: "center", gap: 6 },
  counter: { fontFamily: fonts.bold, fontSize: 13, color: "#fff" },
});
