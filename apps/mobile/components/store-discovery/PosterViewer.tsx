import { Modal, View, Image, ScrollView, Pressable, Dimensions, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

/** A store poster full screen; pinch to read the small print */
export function PosterViewer({ uri, onClose }: { uri: string | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { width, height } = Dimensions.get("window");
  return (
    <Modal visible={!!uri} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <ScrollView maximumZoomScale={4} minimumZoomScale={1} centerContent contentContainerStyle={styles.center} showsHorizontalScrollIndicator={false} showsVerticalScrollIndicator={false}>
          {uri && <Image source={{ uri }} style={{ width, height: height * 0.8 }} resizeMode="contain" />}
        </ScrollView>
        <Pressable onPress={onClose} style={[styles.close, { top: insets.top + 8 }]} accessibilityRole="button" accessibilityLabel="Close poster">
          <Ionicons name="close" size={24} color="#fff" />
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(2,6,23,0.94)" },
  center: { flexGrow: 1, alignItems: "center", justifyContent: "center" },
  close: { position: "absolute", right: 16, width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
});
