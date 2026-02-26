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
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../lib/api";
import { useToast } from "../lib/toast-context";
import { colors, spacing, fontSize } from "../constants/theme";

export default function WriteReviewScreen() {
  const { productId, productName, storeId } = useLocalSearchParams<{
    productId: string;
    productName?: string;
    storeId?: string;
  }>();
  const router = useRouter();
  const toast = useToast();

  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.show("Please select a star rating", "error");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/api/v1/reviews", {
        productId,
        storeId: storeId || undefined,
        rating,
        title: title.trim() || undefined,
        comment: comment.trim() || undefined,
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

        <TouchableOpacity
          style={[styles.submitBtn, (submitting || rating === 0) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting || rating === 0}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>Submit Review</Text>
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
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { fontSize: fontSize.md, fontWeight: "700", color: "#fff" },
});
