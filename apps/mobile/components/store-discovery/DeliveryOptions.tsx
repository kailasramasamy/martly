import { View, Text, FlatList, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../constants/theme";
import type { Store } from "../../lib/types";
import { dayLabel, formatTime } from "./store-info";

type Slot = NonNullable<Store["slots"]>[number];

function SlotChip({ slot }: { slot: Slot }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.day}>{dayLabel(slot.date)}</Text>
      <Text style={styles.time}>{formatTime(slot.startTime)} – {formatTime(slot.endTime)}</Text>
      <Text style={[styles.orderBy, slot.fewLeft && styles.fewLeft]}>
        {slot.fewLeft ? "Few left · " : ""}Order by {formatTime(slot.orderBy)}
      </Text>
    </View>
  );
}

/** Express hours, then every slot still open for booking, side by side; `inset` lets the row run to the card's edges */
export function DeliveryOptions({ store, inset }: { store: Store; inset: number }) {
  const express = store.expressEtaMinutes && store.operatingStart && store.operatingEnd
    ? `${store.expressEtaMinutes} min · ${formatTime(store.operatingStart)} – ${formatTime(store.operatingEnd)}` : null;
  const slots = store.slots ?? [];
  if (!express && slots.length === 0) return null;
  return (
    <View style={styles.wrap}>
      {express && (
        <View style={styles.line}>
          <Ionicons name="flash-outline" size={14} color={colors.primary} />
          <Text style={styles.lineText} numberOfLines={1}><Text style={styles.label}>Express</Text>  {express}</Text>
        </View>
      )}
      {slots.length > 0 && (
        <>
          <View style={styles.line}>
            <Ionicons name="calendar-outline" size={14} color={colors.primary} />
            <Text style={[styles.lineText, styles.label]}>Scheduled delivery</Text>
          </View>
          <FlatList
            horizontal
            data={slots}
            keyExtractor={(s) => `${s.date}-${s.startTime}`}
            renderItem={({ item }) => <SlotChip slot={item} />}
            showsHorizontalScrollIndicator={false}
            style={{ marginHorizontal: -inset }}
            contentContainerStyle={{ paddingHorizontal: inset, gap: 8 }}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 7 },
  line: { flexDirection: "row", alignItems: "center", gap: 7 },
  lineText: { flex: 1, fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary },
  label: { fontFamily: fonts.bold, color: colors.text },
  chip: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, minWidth: 128 },
  day: { fontFamily: fonts.bold, fontSize: 11, color: colors.primary, textTransform: "uppercase", letterSpacing: 0.5 },
  time: { fontFamily: fonts.extrabold, fontSize: 13.5, color: colors.text, marginTop: 2 },
  orderBy: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.textSecondary, marginTop: 2 },
  fewLeft: { color: "#b45309", fontFamily: fonts.bold },
});
