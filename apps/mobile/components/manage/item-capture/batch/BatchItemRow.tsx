import { View, Text, Image, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatCm } from "@martly/shared/item-size";
import { colors, fonts, radius } from "../../../../constants/theme";
import { manage, tabular } from "../../ui/tokens";
import type { BatchItem, BatchReading } from "./use-batch";

/** The measured size on one line: Ø and height for round items, L × W (× H) otherwise */
export function sizeLine(reading: BatchReading) {
  const cm = (mm?: number) => (mm ? formatCm(mm).replace(" cm", "") : "?");
  if (reading.shape === "ROUND") return `Ø ${cm(reading.topDiameterMm)} · H ${cm(reading.heightMm)} cm`;
  if (reading.shape === "FLAT") return `${cm(reading.lengthMm)} × ${cm(reading.widthMm)} cm`;
  return `${cm(reading.lengthMm)} × ${cm(reading.widthMm)} × ${cm(reading.heightMm)} cm`;
}

interface BatchItemRowProps {
  item: BatchItem;
  photo: string;
  number: number;
  /** Position among the sizes of the same item; absent when the item has one size */
  sizeOf?: { index: number; count: number };
  onRemove: () => void;
}

/** A captured item: photo, size, price; sizes of one item share the teal edge */
export function BatchItemRow({ item, photo, number, sizeOf, onRemove }: BatchItemRowProps) {
  const warned = item.reading.warnings.length > 0;
  return (
    <View style={[styles.row, sizeOf && styles.grouped]}>
      <Image source={{ uri: photo }} style={styles.photo} />
      <View style={styles.text}>
        <Text style={styles.number}>
          #{number}{sizeOf ? `  ·  size ${sizeOf.index} of ${sizeOf.count}` : ""}
        </Text>
        <Text style={[styles.size, tabular]}>{sizeLine(item.reading)}</Text>
        <View style={styles.meta}>
          <Text style={[styles.price, tabular]}>{"₹"}{item.price.toLocaleString("en-IN")}</Text>
          {warned && (
            <View style={styles.flag}>
              <Ionicons name="alert-circle" size={13} color={manage.attentionText} />
              <Text style={styles.flagText}>Check size</Text>
            </View>
          )}
        </View>
      </View>
      <TouchableOpacity style={styles.remove} onPress={onRemove} accessibilityRole="button" accessibilityLabel={`Remove item ${number}`}>
        <Ionicons name="trash-outline" size={19} color={manage.muted} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "center", gap: 12, padding: 10, borderRadius: radius.lg,
    backgroundColor: manage.card, borderWidth: 1, borderColor: manage.line,
  },
  grouped: { borderLeftWidth: 4, borderLeftColor: colors.primary },
  photo: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: manage.hairline },
  text: { flex: 1, gap: 2 },
  number: { fontFamily: fonts.semibold, fontSize: 11, color: manage.muted, letterSpacing: 0.4 },
  size: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  meta: { flexDirection: "row", alignItems: "center", gap: 10 },
  price: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textSecondary },
  flag: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm, backgroundColor: manage.attentionBg },
  flagText: { fontFamily: fonts.semibold, fontSize: 11, color: manage.attentionText },
  remove: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
});
