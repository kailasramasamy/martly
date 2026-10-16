import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../constants/theme";

export interface AvailableSlot {
  id: string;
  startTime: string;
  endTime: string;
  maxOrders: number;
  available: number;
  full: boolean;
  /** Today's booking cutoff has passed */
  closed: boolean;
  /** Last time to order for this slot, "HH:MM" */
  orderBy: string;
}

/** A slot can be picked while it's open and has room */
export const isBookable = (slot: AvailableSlot) => !slot.full && !slot.closed;

function clock(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function SlotCard({ slot, selected, onSelect }: { slot: AvailableSlot; selected: boolean; onSelect: () => void }) {
  const off = !isBookable(slot);
  const status = slot.closed
    ? `Closed · order by ${clock(slot.orderBy)}`
    : slot.full
      ? "Full"
      : `Order by ${clock(slot.orderBy)} · ${slot.available} left`;
  return (
    <TouchableOpacity
      style={[styles.card, selected && styles.cardActive, off && styles.cardOff]}
      onPress={onSelect}
      disabled={off}
      activeOpacity={0.7}
      accessibilityState={{ disabled: off, selected }}
    >
      <Text style={[styles.time, selected && styles.timeActive, off && styles.timeOff]}>
        {clock(slot.startTime)} – {clock(slot.endTime)}
      </Text>
      <Text style={[styles.status, selected && styles.statusActive, off && styles.statusOff]}>{status}</Text>
      {selected && (
        <View style={styles.check}>
          <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
        </View>
      )}
    </TouchableOpacity>
  );
}

/** The day's delivery slots: open ones to pick, closed and full ones shown with the reason */
export function SlotGrid({ slots, loading, selectedId, onSelect }: { slots: AvailableSlot[]; loading: boolean; selectedId: string | null; onSelect: (slot: AvailableSlot) => void }) {
  if (loading) return <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />;
  if (slots.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="calendar-outline" size={20} color="#94a3b8" />
        <Text style={styles.emptyText}>No time slots available for this date</Text>
      </View>
    );
  }
  const allClosed = slots.every((s) => s.closed);
  return (
    <>
      {allClosed && <Text style={styles.closedNote}>Orders for today's slots have closed. Pick another day.</Text>}
      <View style={styles.grid}>
        {slots.map((slot) => (
          <SlotCard key={slot.id} slot={slot} selected={selectedId === slot.id} onSelect={() => onSelect(slot)} />
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  card: {
    backgroundColor: "#fff", borderRadius: 10, borderWidth: 1.5, borderColor: colors.border,
    paddingHorizontal: 12, paddingVertical: 10, minWidth: "47%", flex: 1, position: "relative",
  },
  cardActive: { borderColor: colors.primary, backgroundColor: colors.primary + "08" },
  cardOff: { backgroundColor: "#f8fafc", opacity: 0.6 },
  time: { fontSize: 13, fontWeight: "700", color: colors.text },
  timeActive: { color: colors.primary },
  timeOff: { color: "#94a3b8" },
  status: { fontSize: 11, color: "#64748b", marginTop: 2 },
  statusActive: { color: colors.primary },
  statusOff: { fontWeight: "600", color: "#dc2626" },
  check: { position: "absolute", top: 6, right: 6 },
  closedNote: { fontSize: 12, fontWeight: "600", color: "#b45309", marginTop: 12 },
  empty: {
    backgroundColor: "#f8fafc", borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    padding: 20, alignItems: "center", gap: 6, marginTop: 12,
  },
  emptyText: { fontSize: 13, color: "#94a3b8", textAlign: "center" },
});
