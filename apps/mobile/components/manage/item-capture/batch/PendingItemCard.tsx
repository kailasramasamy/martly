import { useState } from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius } from "../../../../constants/theme";
import type { ItemCapture } from "../../../../modules/item-measure";
import { Button } from "../../ui/Button";
import { TextField } from "../../ui/TextField";
import { manage, tabular } from "../../ui/tokens";
import { sizeLine } from "./BatchItemRow";

const toPrice = (text: string) => Number(text.replace(/,/g, ""));

interface PendingItemCardProps {
  capture: ItemCapture;
  /** Which size of its item this is, from 1 */
  sizeNumber: number;
  saving: boolean;
  /** Saves the item with its price; anotherSize keeps the next capture in the same item */
  onSave: (price: number, anotherSize: boolean) => void;
  onDiscard: () => void;
}

/** The item just captured: its size for a quick sanity check, the price, and where the next capture goes */
export function PendingItemCard({ capture, sizeNumber, saving, onSave, onDiscard }: PendingItemCardProps) {
  const [price, setPrice] = useState("");
  const value = toPrice(price);
  const valid = value > 0;
  const photo = capture.photos[capture.shape === "FLAT" ? 0 : 1] ?? capture.photos[0];

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <Image source={{ uri: photo }} style={styles.photo} />
        <View style={styles.reading}>
          <Text style={styles.label}>{sizeNumber > 1 ? `SIZE ${sizeNumber} OF THIS ITEM` : "JUST MEASURED"}</Text>
          <Text style={[styles.size, tabular]}>{sizeLine(capture)}</Text>
          {capture.warnings.map((warning) => (
            <View key={warning} style={styles.warning}>
              <Ionicons name="alert-circle" size={14} color={manage.attentionText} />
              <Text style={styles.warningText}>{warning}</Text>
            </View>
          ))}
        </View>
      </View>
      <TextField label="Price each" required prefix={"₹"} keyboardType="decimal-pad" value={price} onChangeText={setPrice} autoFocus />
      <View style={styles.actions}>
        <Button label="Another size" icon="git-branch-outline" variant="secondary" onPress={() => onSave(value, true)} disabled={!valid || saving} style={styles.action} />
        <Button label="Next item" icon="arrow-forward" onPress={() => onSave(value, false)} loading={saving} disabled={!valid} style={styles.action} />
      </View>
      <Button label="Discard and retake" variant="ghost" compact onPress={onDiscard} disabled={saving} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12, padding: 14, borderRadius: radius.lg, backgroundColor: manage.card, borderWidth: 2, borderColor: colors.primary },
  top: { flexDirection: "row", gap: 12 },
  photo: { width: 88, height: 88, borderRadius: radius.md, backgroundColor: manage.hairline },
  reading: { flex: 1, gap: 4 },
  label: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.8, color: colors.primary },
  size: { fontFamily: fonts.extrabold, fontSize: 20, color: colors.text },
  warning: { flexDirection: "row", gap: 6 },
  warningText: { flex: 1, fontFamily: fonts.medium, fontSize: 13, color: manage.attentionText },
  actions: { flexDirection: "row", gap: 10 },
  action: { flex: 1 },
});
