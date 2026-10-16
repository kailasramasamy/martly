import { ScrollView, Text, StyleSheet } from "react-native";
import { colors, fonts } from "../../../../constants/theme";
import { BottomSheet } from "../../../search/BottomSheet";
import { api } from "../../../../lib/api";
import { useAction } from "../../../../lib/manage/use-action";
import { SwitchRow } from "../../ui/SwitchRow";
import type { PlanRider, PlanWave } from "./types";

interface RosterSheetProps {
  wave: PlanWave | null;
  date: string;
  riders: PlanRider[];
  /** Changing a day's roster needs Delivery setup or Manage riders */
  canEdit: boolean;
  onClose: () => void;
  onChanged: () => void;
}

/** Who rides this slot on this day: the weekly roster, each rider switchable for just today */
export function RosterSheet({ wave, date, riders, canEdit, onClose, onChanged }: RosterSheetProps) {
  const { run, running } = useAction();
  const working = new Set((wave?.roster ?? []).map((r) => r.id));
  const set = async (riderId: string, on: boolean) => {
    if (!wave?.slotId) return;
    const slotId = wave.slotId;
    const res = await run(() => api.put(`/api/v1/delivery-plan/slots/${slotId}/roster/override`, { riderId, date, working: on }));
    if (res !== undefined) onChanged();
  };
  return (
    <BottomSheet visible={!!wave} title={wave ? `Riders · ${wave.label}` : ""} onClose={onClose}>
      <Text style={styles.note}>
        {canEdit ? "Changes apply to this day only. The weekly roster lives in Delivery setup." : "Only people who manage riders can change this."}
      </Text>
      <ScrollView keyboardDismissMode="on-drag">
        {riders.length === 0 && <Text style={styles.note}>No riders work at this store yet.</Text>}
        {riders.map((r) => (
          <SwitchRow key={r.id} label={r.name} description={r.phone ?? undefined} value={working.has(r.id)} disabled={!canEdit || running} onValueChange={(on) => set(r.id, on)} />
        ))}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  note: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, marginBottom: 10 },
});
