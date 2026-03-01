import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { api, getApiUrl, getAccessToken } from "../lib/api";
import { useToast } from "../lib/toast-context";
import { colors, spacing, fontSize } from "../constants/theme";

const MAX_IMAGES = 5;

async function uploadImage(uri: string): Promise<string> {
  const filename = uri.split("/").pop() || "photo.jpg";
  const ext = filename.split(".").pop()?.toLowerCase() || "jpg";
  const mimeType = ext === "png" ? "image/png" : "image/jpeg";

  const formData = new FormData();
  formData.append("file", {
    uri,
    name: filename,
    type: mimeType,
  } as unknown as Blob);

  const res = await fetch(`${getApiUrl()}/api/v1/uploads`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getAccessToken()}` },
    body: formData,
  });

  if (!res.ok) throw new Error("Failed to upload image");
  const json = await res.json();
  return json.data.url;
}

export default function WriteReviewScreen() {
  const { productId, productName, storeId, orderId } = useLocalSearchParams<{
    productId: string;
    productName?: string;
    storeId?: string;
    orderId?: string;
  }>();
  const router = useRouter();
  const toast = useToast();

  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);

  const pickImages = async () => {
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      toast.show(`Maximum ${MAX_IMAGES} photos allowed`, "error");
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      toast.show("Photo library permission is required", "error");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.8,
    });

    if (!result.canceled && result.assets.length > 0) {
      const uris = result.assets.map((a) => a.uri).slice(0, remaining);
      setImages((prev) => [...prev, ...uris]);
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.show("Please select a star rating", "error");
      return;
    }

    setSubmitting(true);
    try {
      // Upload images first
      let imageUrls: string[] | undefined;
      if (images.length > 0) {
        setUploadingImages(true);
        try {
          imageUrls = await Promise.all(images.map(uploadImage));
        } finally {
          setUploadingImages(false);
        }
      }

      await api.post("/api/v1/reviews", {
        productId,
        storeId: storeId || undefined,
        orderId: orderId || undefined,
        rating,
        title: title.trim() || undefined,
        comment: comment.trim() || undefined,
        imageUrls,
      });
      toast.show("Review submitted for approval", "success");
      router.back();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to submit review";
      toast.show(msg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const isUploading = submitting && uploadingImages;
  const submitLabel = isUploading
    ? "Uploading photos..."
    : submitting
      ? "Submitting..."
      : "Submit Review";

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={100}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {productName && <Text style={styles.productName}>{productName}</Text>}

        <Text style={styles.label}>Your Rating</Text>
        <View style={styles.starRow}>
          {[1, 2, 3, 4, 5].map((star) => (
            <TouchableOpacity key={star} onPress={() => setRating(star)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
              <Ionicons
                name={star <= rating ? "star" : "star-outline"}
                size={36}
                color={star <= rating ? "#f59e0b" : "#cbd5e1"}
              />
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Title (optional)</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Brief summary"
          placeholderTextColor="#94a3b8"
          maxLength={200}
        />

        <Text style={styles.label}>Comment (optional)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={comment}
          onChangeText={setComment}
          placeholder="Tell others about your experience..."
          placeholderTextColor="#94a3b8"
          multiline
          numberOfLines={5}
          textAlignVertical="top"
          maxLength={2000}
        />

        <Text style={styles.label}>Photos (optional)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll} contentContainerStyle={styles.imageScrollContent}>
          {images.map((uri, i) => (
            <View key={uri} style={styles.imageThumb}>
              <Image source={{ uri }} style={styles.thumbImage} />
              <TouchableOpacity style={styles.removeBtn} onPress={() => removeImage(i)}>
                <Ionicons name="close-circle" size={22} color="#ef4444" />
              </TouchableOpacity>
            </View>
          ))}
          {images.length < MAX_IMAGES && (
            <TouchableOpacity style={styles.addPhotoBtn} onPress={pickImages}>
              <Ionicons name="camera-outline" size={28} color={colors.textSecondary} />
              <Text style={styles.addPhotoText}>{images.length === 0 ? "Add" : `${images.length}/${MAX_IMAGES}`}</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        <TouchableOpacity
          style={[styles.submitBtn, (submitting || rating === 0) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting || rating === 0}
        >
          {submitting ? (
            <View style={styles.submitLoading}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.submitBtnText}>{submitLabel}</Text>
            </View>
          ) : (
            <Text style={styles.submitBtnText}>{submitLabel}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing.md },
  productName: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text, marginBottom: spacing.md },
  label: { fontSize: fontSize.md, fontWeight: "600", color: colors.text, marginTop: spacing.md, marginBottom: spacing.xs },
  starRow: { flexDirection: "row", gap: 8, paddingVertical: spacing.sm },
  input: {
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    fontSize: fontSize.md,
    color: colors.text,
  },
  textArea: { minHeight: 120 },
  imageScroll: { marginTop: spacing.sm },
  imageScrollContent: { gap: 10, paddingVertical: 4 },
  imageThumb: { width: 80, height: 80, borderRadius: 10, overflow: "visible" },
  thumbImage: { width: 80, height: 80, borderRadius: 10, backgroundColor: colors.border },
  removeBtn: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: "#fff",
    borderRadius: 11,
  },
  addPhotoBtn: {
    width: 80,
    height: 80,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  addPhotoText: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { fontSize: fontSize.md, fontWeight: "700", color: "#fff" },
  submitLoading: { flexDirection: "row", alignItems: "center", gap: 8 },
});
