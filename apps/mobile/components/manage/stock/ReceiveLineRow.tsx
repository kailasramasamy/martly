import { View, Text, Image, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius } from "../../../constants/theme";
import { manage } from "../ui/tokens";
import { QuantityStepper } from "./QuantityStepper";

export interface ReceiveLine {
  storeProductId: string;
  name: string;
  variant: string;
  imageUrl: string | null;
  /** Digits as typed; blank until entered */
  qty: string;
}

interface ReceiveLineRowProps {
  line: ReceiveLine;
  onQty: (storeProductId: string, qty: string) => void;
  onRemove: (storeProductId: string) => void;
}

/** One product on the delivery being received, with quantity and remove */
export function ReceiveLineRow({ line, onQty, onRemove }: ReceiveLineRowProps) {
  return (
    <View style={styles.row}>
      {line.imageUrl
        ? <Image source={{ uri: line.imageUrl }} style={styles.thumb} />
        : <View style={[styles.thumb, styles.thumbEmpty]}><Ionicons name="image-outline" size={18} color={manage.muted} /></View>}
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>{line.name}</Text>
        <Text style={styles.variant} numberOfLines={1}>{line.variant}</Text>
        <TouchableOpacity onPress={() => onRemove(line.storeProductId)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Remove ${line.name}`}>
          <Text style={styles.remove}>Remove</Text>
        </TouchableOpacity>
      </View>
      <QuantityStepper value={line.qty} min={1} onChange={(q) => onQty(line.storeProductId, q)} label={line.name} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "center", gap: 10, minHeight: 80, paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: manage.card, borderBottomWidth: 1, borderBottomColor: manage.hairline,
  },
  thumb: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: manage.canvas },
  thumbEmpty: { alignItems: "center", justifyContent: "center" },
  body: { flex: 1, minWidth: 0 },
  title: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 19, color: colors.text },
  variant: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  remove: { fontFamily: fonts.bold, fontSize: 12, color: colors.error, marginTop: 4 },
});
