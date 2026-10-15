import { useState } from "react";
import { View, Image, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius } from "../../../constants/theme";
import { uploadImage } from "../../../lib/upload";
import { useToast } from "../../../lib/toast-context";
import { manage } from "../ui/tokens";
import { FieldFrame } from "../ui/FieldFrame";

interface ImageGalleryFieldProps {
  label: string;
  value: string[];
  onChange: (urls: string[]) => void;
  hint?: string;
}

/** Row of uploaded images with remove buttons and an add tile; supports picking several at once */
export function ImageGalleryField({ label, value, onChange, hint }: ImageGalleryFieldProps) {
  const toast = useToast();
  const [uploading, setUploading] = useState(false);

  const add = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      toast.show("Photo library permission is required", "error");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85, allowsMultipleSelection: true });
    if (result.canceled) return;
    setUploading(true);
    try {
      const urls = await Promise.all(result.assets.map((a) => uploadImage(a.uri)));
      onChange([...value, ...urls]);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Upload failed", "error");
    } finally {
      setUploading(false);
    }
  };

  return (
    <FieldFrame label={label} hint={hint}>
      <View style={styles.row}>
        {value.map((url, i) => (
          <View key={`${url}-${i}`} style={styles.tile}>
            <Image source={{ uri: url }} style={styles.image} />
            <TouchableOpacity style={styles.remove} onPress={() => onChange(value.filter((_, j) => j !== i))} hitSlop={6} accessibilityLabel="Remove image">
              <Ionicons name="close" size={14} color="#fff" />
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={[styles.tile, styles.addTile]} onPress={add} disabled={uploading} accessibilityLabel={`Add ${label}`}>
          {uploading ? <ActivityIndicator color={colors.primary} /> : (
            <>
              <Ionicons name="add" size={22} color={colors.primary} />
              <Text style={styles.addText}>Add</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </FieldFrame>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: { width: 76, height: 76, borderRadius: radius.md, overflow: "hidden", backgroundColor: manage.canvas },
  image: { width: "100%", height: "100%" },
  remove: { position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(15,23,42,0.7)", alignItems: "center", justifyContent: "center" },
  addTile: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderStyle: "dashed", borderColor: manage.line },
  addText: { fontFamily: fonts.bold, fontSize: 12, color: colors.primary },
});
