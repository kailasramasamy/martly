import { useState } from "react";
import { View, StyleSheet } from "react-native";
import { radius } from "../../../constants/theme";
import { PhotoSwiper } from "./PhotoSwiper";
import { PhotoViewer } from "./PhotoViewer";

/** Large swipeable photos filling the available width; tapping one opens it full screen */
export function PhotoGallery({ photos, name }: { photos: string[]; name: string }) {
  const [width, setWidth] = useState(0);
  const [open, setOpen] = useState<number | null>(null);
  return (
    <View style={styles.gallery} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && <PhotoSwiper photos={photos} size={width} onPress={setOpen} accessibilityLabel={`${name} photo, opens full screen`} />}
      <PhotoViewer photos={photos} index={open} onClose={() => setOpen(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  gallery: { borderRadius: radius.lg, overflow: "hidden", backgroundColor: "#fff" },
});
