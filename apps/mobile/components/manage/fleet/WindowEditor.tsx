import { useState } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { colors, fonts } from "../../../constants/theme";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import { BottomSheet } from "../../search/BottomSheet";
import { Button } from "../ui/Button";
import { ListRow } from "../ui/ListRow";
import { WeekdayStrip } from "./WeekdayStrip";
import { riderDays } from "./windows";
import type { FleetRider, RosterWindow } from "./types";

interface WindowEditorProps {
  storeId: string;
  window: RosterWindow;
  riders: FleetRider[];
  onClose: () => void;
  onSaved: () => void;
}

const toggled = <T,>(set: Set<T>, item: T) => {
  const next = new Set(set);
  if (next.has(item)) next.delete(item);
  else next.add(item);
  return next;
};

/** Pick who rides a time window and on which weekdays; the same riders are saved to each chosen day's slot */
function EditorBody({ storeId, window, riders, onClose, onSaved }: WindowEditorProps) {
  const { run, running } = useAction();
  const available = new Set(window.slots.map((s) => s.dayOfWeek));
  const [days, setDays] = useState(available);
  const [chosen, setChosen] = useState(() => new Set(riderDays(window).keys()));

  const save = async () => {
    const slotIds = window.slots.filter((s) => days.has(s.dayOfWeek)).map((s) => s.id);
    const saved = await run(() => api.put("/api/v1/delivery-plan/roster", { storeId, slotIds, riderIds: [...chosen] }), "Roster saved");
    if (saved) onSaved();
  };

  return (
    <>
      <ScrollView keyboardDismissMode="on-drag">
        <Text style={styles.label}>Days</Text>
        <View style={styles.days}><WeekdayStrip available={available} selected={days} onToggle={(d) => setDays((s) => toggled(s, d))} /></View>
        <Text style={styles.label}>Riders</Text>
        {riders.length === 0 && <Text style={styles.note}>No riders work at this store yet. Add riders first.</Text>}
        {riders.map((r) => (
          <ListRow key={r.id} icon="bicycle-outline" title={r.name} subtitle={r.phone ?? undefined} selected={chosen.has(r.id)} onPress={() => setChosen((s) => toggled(s, r.id))} />
        ))}
      </ScrollView>
      <View style={styles.footer}>
        <Button label="Save roster" onPress={save} loading={running} disabled={days.size === 0} />
        <Button label="Cancel" variant="secondary" onPress={onClose} />
      </View>
    </>
  );
}

export function WindowEditor(props: Omit<WindowEditorProps, "window"> & { window: RosterWindow | null }) {
  const { window, ...rest } = props;
  return (
    <BottomSheet flush visible={!!window} title={window ? `Riders · ${window.label}` : ""} onClose={props.onClose}>
      {window && <EditorBody key={window.key} window={window} {...rest} />}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.9, textTransform: "uppercase", color: colors.textSecondary, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  days: { paddingHorizontal: 16 },
  note: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.textSecondary, paddingHorizontal: 16 },
  footer: { padding: 16, gap: 10 },
});
