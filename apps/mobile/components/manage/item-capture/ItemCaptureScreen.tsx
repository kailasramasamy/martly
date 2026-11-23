import { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../lib/api";
import { useToast } from "../../../lib/toast-context";
import { useAction } from "../../../lib/manage/use-action";
import { colors, fonts, radius } from "../../../constants/theme";
import { canMeasureItems, captureItem } from "../../../modules/item-measure";
import { ManageStackScreen } from "../ManageStackScreen";
import { useStoreScope } from "../StoreScope";
import { ListingsNotice, useListingsGate } from "../catalog-drafts/ListingsNotice";
import { PhotoStrip } from "../catalog-drafts/PhotoStrip";
import { useCapturePhotos } from "../catalog-drafts/use-capture-photos";
import { Button } from "../ui/Button";
import { SectionCard } from "../ui/SectionCard";
import { TextField } from "../ui/TextField";
import { manage } from "../ui/tokens";
import { ItemSizeFields } from "./ItemSizeFields";
import { useItemSize } from "./use-item-size";

const toPrice = (text: string) => Number(text.replace(/,/g, ""));

function Warnings({ warnings }: { warnings: string[] }) {
  return (
    <View style={styles.warnings}>
      {warnings.map((warning) => (
        <View key={warning} style={styles.warning}>
          <Ionicons name="alert-circle" size={16} color={manage.attentionText} />
          <Text style={styles.warningText}>{warning}</Text>
        </View>
      ))}
      <Text style={styles.warningText}>Retake it, or check the size below with a ruler.</Text>
    </View>
  );
}

/** Measure an unpacked item: guided photos, confirm the size and price, and the queue does the rest */
export function ItemCaptureScreen() {
  const router = useRouter();
  const toast = useToast();
  const { storeId, picker } = useStoreScope({ required: true, placeholder: "Choose a store" });
  const photos = useCapturePhotos();
  const size = useItemSize();
  const listings = useListingsGate();
  const { run, running } = useAction();
  const [canMeasure, setCanMeasure] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [sent, setSent] = useState(0);

  useEffect(() => { canMeasureItems().then(setCanMeasure); }, []);

  const measure = async () => {
    try {
      const capture = await captureItem();
      if (!capture) return;
      photos.reset();
      photos.add(capture.photos);
      size.load(capture);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't open the camera", "error");
    }
  };

  const priceValue = toPrice(price);
  const stockValue = stock.trim() === "" ? 0 : Number(stock);
  const stockError = stock && !(Number.isInteger(stockValue) && stockValue >= 0) ? "Whole number" : null;
  const canSubmit = !listings.blocked && !!storeId && photos.ready && size.valid && priceValue > 0 && !stockError;

  const submit = async () => {
    const created = await run(() => api.post("/api/v1/catalog-drafts", {
      storeId,
      photos: photos.urls,
      ...(name.trim() ? { hintName: name.trim() } : {}),
      mrp: priceValue,
      sellingPrice: priceValue,
      stock: stockValue,
      item: size.payload(),
    }), "Queued — next item");
    if (!created) return;
    photos.reset();
    size.reset();
    setName("");
    setPrice("");
    setStock("");
    setSent((n) => n + 1);
    listings.reload();
  };

  const measured = !!size.reading;
  return (
    <ManageStackScreen
      title="Measure an item"
      actions={<Button label="Submit & next" icon="arrow-forward" onPress={submit} loading={running} disabled={!canSubmit} style={styles.submit} />}
    >
      {sent > 0 && (
        <Button label={`${sent} sent · View queue`} icon="checkmark-circle" variant="ghost" onPress={() => router.push("/manage/catalog-drafts")} />
      )}
      {picker}
      <ListingsNotice left={listings.left} waiting={listings.waiting} />
      {!listings.blocked && <SectionCard title="Photos">
        <Text style={styles.hint}>
          {canMeasure
            ? "Put the item on a counter and take Top, Front, Angled and Side views. The phone works out the size."
            : "This phone can't measure, so take photos from the top, front and side, then type the size with a ruler."}
        </Text>
        <PhotoStrip photos={photos.photos} onRemove={photos.remove} onRetry={photos.retry} />
        <View style={styles.camera}>
          {canMeasure
            ? <Button label={measured ? "Measure again" : "Start measuring"} icon="scan" onPress={measure} />
            : <Button label={photos.photos.length ? "Take another photo" : "Take photo"} icon="camera" onPress={photos.takePhoto} />}
        </View>
        {(size.reading?.warnings.length ?? 0) > 0 && <Warnings warnings={size.reading!.warnings} />}
      </SectionCard>}
      {!listings.blocked && (measured || !canMeasure) && (
        <>
          <ItemSizeFields form={size} />
          <SectionCard title="Details">
            <TextField label="Price each" required prefix={"₹"} keyboardType="decimal-pad" value={price} onChangeText={setPrice} />
            <TextField label="Stock" keyboardType="number-pad" value={stock} onChangeText={setStock} placeholder="Optional" error={stockError} />
            <TextField label="Name" value={name} onChangeText={setName} placeholder="Optional — we name it from the photos" maxLength={120} />
          </SectionCard>
        </>
      )}
    </ManageStackScreen>
  );
}

const styles = StyleSheet.create({
  hint: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
  camera: { marginTop: 12, gap: 4 },
  submit: { flex: 1 },
  warnings: { marginTop: 12, padding: 12, gap: 8, borderRadius: radius.lg, backgroundColor: manage.attentionBg },
  warning: { flexDirection: "row", gap: 8 },
  warningText: { flex: 1, fontFamily: fonts.medium, fontSize: 13, color: manage.attentionText },
});
