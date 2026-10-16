import { View, StyleSheet } from "react-native";
import { Button } from "../../ui/Button";
import type { PlanActions } from "./use-plan-actions";
import type { PlanWave } from "./types";

interface PlanButtonsProps {
  wave: PlanWave;
  actions: PlanActions;
}

/** Plan or re-plan the wave, and hand every suggested rider their trip in one tap */
export function PlanButtons({ wave, actions }: PlanButtonsProps) {
  const planned = wave.trips.filter((t) => t.status === "PLANNED");
  const suggested = planned.filter((t) => t.suggestedRiderId);
  const canPlan = wave.pool.length > 0 || planned.length > 0;
  if (!canPlan) return null;
  return (
    <View style={styles.row}>
      <Button
        label={planned.length > 0 ? "Re-plan" : "Plan trips"}
        icon="git-network-outline"
        variant={suggested.length > 0 ? "secondary" : "primary"}
        loading={actions.running}
        onPress={actions.plan}
        style={styles.flex}
      />
      {suggested.length > 0 && (
        <Button label={`Assign all (${suggested.length})`} icon="checkmark-done" loading={actions.running} onPress={() => actions.assignAll(suggested)} style={styles.flex} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 10, marginTop: 14 },
  flex: { flex: 1 },
});
