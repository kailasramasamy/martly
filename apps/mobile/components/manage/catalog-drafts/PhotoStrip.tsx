import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { Loader } from "../../Loader";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius } from "../../../constants/theme";
import { manage } from "../ui/tokens";
import type { CapturePhoto } from "./use-capture-photos";

interface PhotoStripProps {
  photos: CapturePhoto[];
  onRemove: (key: number) => void;
  onRetry: (key: number) => void;
}

function Thumb({ photo, index, onRemove, onRetry }: { photo: CapturePhoto; index: number } & Omit<PhotoStripProps, "photos">) {
  return (
    <View style={styles.thumbWrap}>
      <TouchableOpacity
        style={styles.thumb}
        disabled={photo.state !== "error"}
        onPress={() => onRetry(photo.key)}
        accessibilityLabel={photo.state === "error" ? "Retry upload" : `Photo ${index + 1}`}
      >
        <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} />
        {photo.state === "uploading" && <View style={styles.overlay}><Loader color="#fff" /></View>}
        {photo.state === "error" && (
          <View style={[styles.overlay, styles.errorOverlay]}>
            <Ionicons name="refresh" size={22} color="#fff" />
            <Text style={styles.errorText}>Retry</Text>
          </View>
        )}
        {index === 0 && <View style={styles.front}><Text style={styles.frontText}>FRONT</Text></View>}
      </TouchableOpacity>
      <TouchableOpacity style={styles.remove} onPress={() => onRemove(photo.key)} hitSlop={8} accessibilityLabel="Remove photo">
        <Ionicons name="close" size={14} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

export function PhotoStrip({ photos, onRemove, onRetry }: PhotoStripProps) {
  if (photos.length === 0) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {photos.map((p, i) => <Thumb key={p.key} photo={p} index={i} onRemove={onRemove} onRetry={onRetry} />)}
    </ScrollView>
  );
}

const SIZE = 76;

const styles = StyleSheet.create({
  row: { gap: 10, paddingTop: 8, paddingRight: 8 },
  thumbWrap: { width: SIZE, height: SIZE },
  thumb: { width: SIZE, height: SIZE, borderRadius: radius.md, overflow: "hidden", backgroundColor: manage.canvas },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15,23,42,0.45)", alignItems: "center", justifyContent: "center" },
  errorOverlay: { backgroundColor: "rgba(185,28,28,0.75)" },
  errorText: { fontFamily: fonts.bold, fontSize: 11, color: "#fff" },
  front: { position: "absolute", left: 0, bottom: 0, backgroundColor: colors.primary, paddingHorizontal: 6, paddingVertical: 2, borderTopRightRadius: radius.sm },
  frontText: { fontFamily: fonts.extrabold, fontSize: 9, color: "#fff", letterSpacing: 0.6 },
  remove: { position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.text, alignItems: "center", justifyContent: "center" },
});
