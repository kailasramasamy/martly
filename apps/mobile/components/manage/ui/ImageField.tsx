import { useState } from "react";
import { View, Image, TouchableOpacity, Text, StyleSheet } from "react-native";
import { Loader } from "../../Loader";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius } from "../../../constants/theme";
import { uploadImage } from "../../../lib/upload";
import { useToast } from "../../../lib/toast-context";
import { manage } from "./tokens";
import { FieldFrame, type FieldFrameProps } from "./FieldFrame";

interface ImageFieldProps extends FieldFrameProps {
  value: string | null;
  onChange: (url: string | null) => void;
  /** Width / height, e.g. 1 for square product shots, 2.5 for banners */
  aspect?: number;
  /** Uploads the picked image and returns its URL; defaults to the plain image upload */
  upload?: (uri: string) => Promise<string>;
  /** Show the whole image (logos) instead of filling the frame */
  contain?: boolean;
}

export function ImageField({ label, required, hint, error, value, onChange, aspect = 1, upload = uploadImage, contain }: ImageFieldProps) {
  const toast = useToast();
  const [uploading, setUploading] = useState(false);

  const pick = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      toast.show("Photo library permission is required", "error");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85 });
    if (result.canceled || !result.assets[0]) return;
    setUploading(true);
    try {
      onChange(await upload(result.assets[0].uri));
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Upload failed", "error");
    } finally {
      setUploading(false);
    }
  };

  return (
    <FieldFrame label={label} required={required} hint={hint} error={error}>
      <TouchableOpacity style={[styles.frame, { aspectRatio: aspect }]} onPress={pick} disabled={uploading} activeOpacity={0.8}>
        {value ? <Image source={{ uri: value }} style={StyleSheet.absoluteFill} resizeMode={contain ? "contain" : "cover"} /> : (
          <View style={styles.empty}>
            <Ionicons name="cloud-upload-outline" size={24} color={colors.primary} />
            <Text style={styles.emptyText}>Upload image</Text>
          </View>
        )}
        {uploading && <View style={styles.overlay}><Loader color="#fff" /></View>}
      </TouchableOpacity>
      {value && !uploading && (
        <View style={styles.actions}>
          <TouchableOpacity onPress={pick} hitSlop={8}><Text style={styles.action}>Replace</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => onChange(null)} hitSlop={8}><Text style={[styles.action, styles.remove]}>Remove</Text></TouchableOpacity>
        </View>
      )}
    </FieldFrame>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: "100%", maxHeight: 260, borderRadius: radius.lg, overflow: "hidden",
    borderWidth: 1, borderStyle: "dashed", borderColor: manage.line, backgroundColor: manage.canvas,
  },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 6 },
  emptyText: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15,23,42,0.45)", alignItems: "center", justifyContent: "center" },
  actions: { flexDirection: "row", gap: 20, marginTop: 8 },
  action: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary },
  remove: { color: colors.error },
});
