import { useState, useEffect, useCallback, useRef } from "react";
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
  Keyboard,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { api, getApiUrl, getAccessToken } from "../lib/api";
import { useToast } from "../lib/toast-context";
import { colors, spacing, fontSize } from "../constants/theme";

const MAX_IMAGES = 5;

const RETURN_REASONS = [
  "Damaged/broken item",
  "Wrong item received",
  "Item expired/stale",
  "Quality not as expected",
  "Missing items",
  "Other",
];

interface OrderItemData {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
  product: { name: string };
  variant?: { name: string; unitType: string; unitValue: string } | null;
}

interface OrderData {
  id: string;
  items: OrderItemData[];
}

interface SelectedItem {
  orderItemId: string;
  quantity: number;
  maxQuantity: number;
  unitPrice: number;
}

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

export default function ReturnRequestScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();
  const toast = useToast();

  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<Map<string, SelectedItem>>(new Map());
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const descriptionY = useRef(0);

  const fetchOrder = useCallback(async () => {
    if (!orderId) {
      setLoading(false);
      return;
    }
    try {
      const res = await api.get<OrderData>(`/api/v1/orders/${orderId}`);
      setOrder(res.data);
      const initial = new Map<string, SelectedItem>();
      res.data.items.forEach((item) => {
        initial.set(item.id, {
          orderItemId: item.id,
          quantity: item.quantity,
          maxQuantity: item.quantity,
          unitPrice: Number(item.unitPrice),
        });
      });
      setSelectedItems(initial);
    } catch {
      toast.show("Failed to load order", "error");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const toggleItem = (itemId: string, item: OrderItemData) => {
    setSelectedItems((prev) => {
      const next = new Map(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.set(itemId, {
          orderItemId: itemId,
          quantity: item.quantity,
          maxQuantity: item.quantity,
          unitPrice: Number(item.unitPrice),
        });
      }
      return next;
    });
  };

  const adjustQuantity = (itemId: string, delta: number) => {
    setSelectedItems((prev) => {
      const next = new Map(prev);
      const current = next.get(itemId);
      if (!current) return prev;
      const newQty = current.quantity + delta;
      if (newQty < 1 || newQty > current.maxQuantity) return prev;
      next.set(itemId, { ...current, quantity: newQty });
      return next;
    });
  };

  const refundAmount = Array.from(selectedItems.values()).reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0
  );

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
    if (selectedItems.size === 0) {
      toast.show("Please select at least one item", "error");
      return;
    }
    if (!reason) {
      toast.show("Please select a reason", "error");
      return;
    }

    setSubmitting(true);
    try {
      let imageUrls: string[] | undefined;
      if (images.length > 0) {
        setUploadingImages(true);
        try {
          imageUrls = await Promise.all(images.map(uploadImage));
        } finally {
          setUploadingImages(false);
        }
      }

      await api.post("/api/v1/return-requests", {
        orderId,
        reason,
        description: description.trim() || undefined,
        imageUrls: imageUrls || undefined,
        items: Array.from(selectedItems.values()).map((item) => ({
          orderItemId: item.orderItemId,
          quantity: item.quantity,
        })),
      });

      toast.show("Return request submitted", "success");
      router.back();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to submit return request";
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
      : "Submit Return Request";
  const canSubmit = selectedItems.size > 0 && reason !== "" && !submitting;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Order not found</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={100}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        {/* Select Items */}
        <Text style={styles.sectionTitle}>Select Items</Text>
        <View style={styles.card}>
          {order.items.map((item) => {
            const selected = selectedItems.has(item.id);
            const sel = selectedItems.get(item.id);
            return (
              <View key={item.id} style={styles.itemRow}>
                <TouchableOpacity
                  style={styles.checkbox}
                  onPress={() => toggleItem(item.id, item)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name={selected ? "checkbox" : "square-outline"}
                    size={24}
                    color={selected ? colors.primary : colors.textSecondary}
                  />
                </TouchableOpacity>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName} numberOfLines={1}>{item.product.name}</Text>
                  {item.variant && (
                    <Text style={styles.itemVariant}>{item.variant.name}</Text>
                  )}
                  <Text style={styles.itemPrice}>{"\u20B9"}{Number(item.unitPrice).toFixed(0)} each</Text>
                </View>
                {selected && sel && (
                  <View style={styles.qtyControl}>
                    <TouchableOpacity
                      style={[styles.qtyBtn, sel.quantity <= 1 && styles.qtyBtnDisabled]}
                      onPress={() => adjustQuantity(item.id, -1)}
                      disabled={sel.quantity <= 1}
                    >
                      <Ionicons name="remove" size={16} color={sel.quantity <= 1 ? colors.border : colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.qtyText}>{sel.quantity}</Text>
                    <TouchableOpacity
                      style={[styles.qtyBtn, sel.quantity >= sel.maxQuantity && styles.qtyBtnDisabled]}
                      onPress={() => adjustQuantity(item.id, 1)}
                      disabled={sel.quantity >= sel.maxQuantity}
                    >
                      <Ionicons name="add" size={16} color={sel.quantity >= sel.maxQuantity ? colors.border : colors.text} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Reason */}
        <Text style={styles.sectionTitle}>Reason</Text>
        <View style={styles.card}>
          {RETURN_REASONS.map((r) => (
            <TouchableOpacity
              key={r}
              style={styles.reasonRow}
              onPress={() => setReason(r)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={reason === r ? "radio-button-on" : "radio-button-off"}
                size={22}
                color={reason === r ? colors.primary : colors.textSecondary}
              />
              <Text style={[styles.reasonText, reason === r && styles.reasonTextSelected]}>{r}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Description */}
        <Text style={styles.sectionTitle}>Description <Text style={styles.optionalLabel}>(optional)</Text></Text>
        <View onLayout={(e) => { descriptionY.current = e.nativeEvent.layout.y; }}>
          <TextInput
            style={styles.textArea}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe the issue in detail..."
            placeholderTextColor="#94a3b8"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            maxLength={1000}
            onFocus={() => {
              setTimeout(() => {
                scrollRef.current?.scrollTo({ y: descriptionY.current, animated: true });
              }, 300);
            }}
          />
        </View>

        {/* Photos */}
        <Text style={styles.sectionTitle}>Photos <Text style={styles.optionalLabel}>(optional)</Text></Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.imageScroll}
          contentContainerStyle={styles.imageScrollContent}
        >
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
              <Text style={styles.addPhotoText}>
                {images.length === 0 ? "Add" : `${images.length}/${MAX_IMAGES}`}
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* Refund Summary */}
        <View style={styles.refundCard}>
          <View style={styles.refundRow}>
            <Text style={styles.refundLabel}>Estimated Refund</Text>
            <Text style={styles.refundAmount}>
              {"\u20B9"}{refundAmount.toFixed(0)}
            </Text>
          </View>
          <Text style={styles.refundNote}>
            {selectedItems.size === 0
              ? "Select items to see refund amount"
              : `${selectedItems.size} item${selectedItems.size > 1 ? "s" : ""} selected`}
          </Text>
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
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
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: 40 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { fontSize: fontSize.lg, color: colors.textSecondary },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  optionalLabel: {
    fontSize: fontSize.sm,
    fontWeight: "400",
    color: colors.textSecondary,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  checkbox: {
    marginRight: spacing.sm,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.text,
  },
  itemVariant: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 1,
  },
  itemPrice: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  qtyControl: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  qtyBtnDisabled: {
    opacity: 0.4,
  },
  qtyText: {
    fontSize: fontSize.md,
    fontWeight: "700",
    color: colors.text,
    minWidth: 28,
    textAlign: "center",
  },
  reasonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  reasonText: {
    fontSize: fontSize.md,
    color: colors.text,
  },
  reasonTextSelected: {
    fontWeight: "600",
    color: colors.primary,
  },
  textArea: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    fontSize: fontSize.md,
    color: colors.text,
    minHeight: 100,
  },
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
    backgroundColor: colors.surface,
  },
  addPhotoText: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  refundCard: {
    backgroundColor: "#f0fdf4",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  refundRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  refundLabel: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    color: colors.text,
  },
  refundAmount: {
    fontSize: fontSize.xl,
    fontWeight: "700",
    color: "#16a34a",
  },
  refundNote: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 4,
  },
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
