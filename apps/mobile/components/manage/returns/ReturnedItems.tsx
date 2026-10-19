import { View, Text, Image, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../../constants/theme";
import { SectionCard } from "../ui/SectionCard";
import { formatINR, manage, tabular } from "../ui/tokens";
import type { ReturnRequestDetail } from "./types";

type Item = ReturnRequestDetail["items"][number];

/** Whether this line goes back on the shelf, and whether that has happened yet */
function stockNote(item: Item, received: boolean): { text: string; on: boolean } | null {
  if (!item.restock) return received ? { text: "Not restocked", on: false } : null;
  return received ? { text: "Back in stock", on: true } : { text: "Goes back in stock when received", on: false };
}

function ItemRow({ item, received }: { item: Item; received: boolean }) {
  const { product, variant, unitPrice } = item.orderItem;
  const image = variant.imageUrl ?? product.imageUrl ?? product.images?.[0];
  const note = stockNote(item, received);
  return (
    <View style={styles.item}>
      <View style={styles.thumb}>
        {image ? <Image source={{ uri: image }} style={styles.thumbImage} resizeMode="contain" /> : <Ionicons name="cube-outline" size={22} color={manage.muted} />}
      </View>
      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
        <Text style={styles.meta}>{variant.name} · {item.quantity} × {formatINR(unitPrice)}</Text>
        {note && <Text style={[styles.note, note.on && styles.noteOn]}>{note.text}</Text>}
      </View>
      <Text style={[styles.total, tabular]}>{formatINR(item.quantity * Number(unitPrice))}</Text>
    </View>
  );
}

/** The returned lines with their photos, so staff can match what came back */
export function ReturnedItems({ request }: { request: ReturnRequestDetail }) {
  return (
    <SectionCard title="Returned items">
      {request.items.map((item) => <ItemRow key={item.id} item={item} received={!!request.receivedAt} />)}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: manage.hairline },
  thumb: { width: 56, height: 56, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#fff", borderWidth: 1, borderColor: manage.hairline, overflow: "hidden" },
  thumbImage: { width: "88%", height: "88%" },
  text: { flex: 1, minWidth: 0 },
  name: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.text },
  meta: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary, marginTop: 2 },
  note: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.textSecondary, marginTop: 3 },
  noteOn: { color: colors.primary },
  total: { fontFamily: fonts.extrabold, fontSize: 14.5, color: colors.text },
});
