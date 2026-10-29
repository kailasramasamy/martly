import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../lib/api";
import { colors, fonts, radius } from "../../../constants/theme";
import { useAction } from "../../../lib/manage/use-action";
import { ManageStackScreen } from "../ManageStackScreen";
import { useStoreScope } from "../StoreScope";
import { Button } from "../ui/Button";
import { SectionCard } from "../ui/SectionCard";
import { TextField } from "../ui/TextField";
import { manage } from "../ui/tokens";
import { ListingsNotice } from "./ListingsNotice";
import { PhotoStrip } from "./PhotoStrip";
import { MAX_PHOTOS, useCapturePhotos } from "./use-capture-photos";
import { useCaptureForm } from "./use-capture-form";

function QueueLink({ count, onPress }: { count: number; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.queueLink} onPress={onPress} accessibilityRole="link">
      <Ionicons name="checkmark-circle" size={18} color={colors.success} />
      <Text style={styles.queueText}>{count} sent to the queue this session</Text>
      <Text style={styles.queueAction}>View queue</Text>
    </TouchableOpacity>
  );
}

export function CaptureScreen() {
  const router = useRouter();
  const { storeId, picker } = useStoreScope({ required: true, placeholder: "Choose a store" });
  const photos = useCapturePhotos();
  const form = useCaptureForm();
  const { run, running } = useAction();
  const [sent, setSent] = useState(0);
  const full = photos.photos.length >= MAX_PHOTOS;

  const submit = async () => {
    const created = await run(() => api.post("/api/v1/catalog-drafts", {
      storeId,
      photos: photos.urls,
      ...(form.name.trim() ? { hintName: form.name.trim() } : {}),
      mrp: form.mrpValue,
      sellingPrice: form.priceValue,
      stock: form.stockValue,
    }), "Queued — next product");
    if (!created) return;
    photos.reset();
    form.reset();
    setSent((n) => n + 1);
  };

  const canSubmit = !!storeId && photos.ready && form.valid;

  return (
    <ManageStackScreen
      title="Add product"
      actions={<Button label="Submit & next" icon="arrow-forward" onPress={submit} loading={running} disabled={!canSubmit} style={styles.submit} />}
    >
      {sent > 0 && <QueueLink count={sent} onPress={() => router.push("/manage/catalog-drafts")} />}
      {picker}
      <ListingsNotice />
      <SectionCard title={`Photos (${photos.photos.length}/${MAX_PHOTOS})`}>
        <Text style={styles.hint}>Start with the front of the pack, then the back, sides and nutrition panel. Hold the phone level with the pack, straight on, not from above.</Text>
        <PhotoStrip photos={photos.photos} onRemove={photos.remove} onRetry={photos.retry} />
        <View style={styles.camera}>
          <Button label={photos.photos.length ? "Take another photo" : "Take photo"} icon="camera" onPress={photos.takePhoto} disabled={full} />
          <Button label="Add from gallery" icon="images-outline" variant="ghost" onPress={photos.pickFromGallery} disabled={full} />
        </View>
      </SectionCard>
      <SectionCard title="Details">
        <TextField label="Name" value={form.name} onChangeText={form.setName} placeholder="Optional — we read it from the pack" maxLength={120} />
        <TextField label="MRP" required prefix={"₹"} keyboardType="decimal-pad" value={form.mrp} onChangeText={form.setMrp} error={form.mrpError} />
        <TextField label="Selling price" required prefix={"₹"} keyboardType="decimal-pad" value={form.price} onChangeText={form.setPrice} error={form.priceError} />
        <TextField label="Stock" keyboardType="number-pad" value={form.stock} onChangeText={form.setStock} placeholder="Optional" error={form.stockError} />
      </SectionCard>
    </ManageStackScreen>
  );
}

const styles = StyleSheet.create({
  hint: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
  camera: { marginTop: 12, gap: 4 },
  submit: { flex: 1 },
  queueLink: {
    flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, paddingHorizontal: 12,
    backgroundColor: manage.tint, borderRadius: radius.lg, borderWidth: 1, borderColor: manage.line,
  },
  queueText: { flex: 1, fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  queueAction: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary },
});
