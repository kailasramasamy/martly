import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../../../constants/theme";
import { SectionCard } from "../../ui/SectionCard";
import { manage, tabular } from "../../ui/tokens";
import { cutoffText, poolSummary } from "./format";
import type { PlanWave } from "./types";

interface WaveSummaryProps {
  wave: PlanWave;
  onRiders: () => void;
  children?: React.ReactNode;
}

function Stat({ label, value, onPress }: { label: string; value: string; onPress?: () => void }) {
  const body = (
    <>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.statValueRow}>
        <Text style={[styles.statValue, tabular]}>{value}</Text>
        {onPress && <Ionicons name="chevron-forward" size={14} color={colors.primary} />}
      </View>
    </>
  );
  return onPress
    ? <TouchableOpacity style={styles.stat} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label} ${value}`}>{body}</TouchableOpacity>
    : <View style={styles.stat}>{body}</View>;
}

/** The selected wave at a glance: window, cutoff, bookings, roster and what's still unplanned */
export function WaveSummary({ wave, onRiders, children }: WaveSummaryProps) {
  const cutoff = cutoffText(wave);
  const passed = !!cutoff?.includes("passed");
  const isSlot = wave.kind === "SLOT";
  return (
    <SectionCard>
      <View style={styles.head}>
        <Ionicons name={isSlot ? "time-outline" : "flash"} size={20} color={colors.primary} />
        <Text style={[styles.title, tabular]}>{wave.label}</Text>
        {cutoff && <Text style={[styles.cutoff, passed && styles.cutoffPassed]}>{cutoff}</Text>}
      </View>
      {isSlot && (
        <View style={styles.stats}>
          <Stat label="BOOKED" value={`${wave.booked ?? 0} / ${wave.capacity ?? 0}`} />
          <Stat label="RIDERS" value={String(wave.roster?.length ?? 0)} onPress={onRiders} />
        </View>
      )}
      <Text style={styles.pool}>{wave.pool.length > 0 ? poolSummary(wave.pool) : "Everything is on a trip"}</Text>
      {children}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { flex: 1, fontFamily: fonts.extrabold, fontSize: 20, color: colors.text },
  cutoff: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.textSecondary },
  cutoffPassed: { color: manage.attentionText },
  stats: { flexDirection: "row", gap: 10, marginTop: 12 },
  stat: { flex: 1, minHeight: 56, justifyContent: "center", paddingHorizontal: 12, borderRadius: 10, backgroundColor: manage.canvas },
  statLabel: { fontFamily: fonts.bold, fontSize: 10.5, letterSpacing: 0.9, color: colors.textSecondary },
  statValueRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  statValue: { fontFamily: fonts.extrabold, fontSize: 17, color: colors.text },
  pool: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.textSecondary, marginTop: 12 },
});
