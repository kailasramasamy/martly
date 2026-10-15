import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { colors, fonts } from "../../../constants/theme";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import { useToast } from "../../../lib/toast-context";
import { manage } from "../ui/tokens";
import { SectionCard } from "../ui/SectionCard";
import { TextField } from "../ui/TextField";
import { SwitchRow } from "../ui/SwitchRow";
import { Button } from "../ui/Button";
import { SelectField } from "../ui/SelectField";
import { FieldFrame } from "../ui/FieldFrame";
import { ManageStackScreen } from "../ManageStackScreen";
import { TimeSelect } from "./TimeSelect";
import { DeleteAction } from "./DeleteAction";
import { DAY_NAMES, DAY_SHORT, type DeliverySlot } from "./types";
import { numberText, parseNumber } from "./numbers";

interface SlotFormProps {
  storeId: string;
  slot?: DeliverySlot;
}

function DayChips({ value, onChange }: { value: number[]; onChange: (days: number[]) => void }) {
  const toggle = (d: number) => onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d]);
  return (
    <FieldFrame label="Days" required hint="Pick every day this window applies to">
      <View style={styles.chips}>
        {DAY_SHORT.map((name, d) => {
          const on = value.includes(d);
          return (
            <TouchableOpacity key={name} style={[styles.chip, on && styles.chipOn]} onPress={() => toggle(d)} accessibilityState={{ selected: on }}>
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{name}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </FieldFrame>
  );
}

function validate(days: number[], start: string | null, end: string | null, max: number | null, cutoff: number | null): string | null {
  if (days.length === 0) return "Select at least one day";
  if (!start || !end) return "Start and end time are required";
  if (start >= end) return "Start time must be before end time";
  if (max === null || !Number.isInteger(max) || max < 1) return "Max orders must be a whole number of 1 or more";
  if (cutoff === null || !Number.isInteger(cutoff) || cutoff < 0) return "Cutoff must be a whole number of minutes";
  return null;
}

interface SlotFields {
  startTime: string | null;
  endTime: string | null;
  maxOrders: number | null;
  cutoffMinutes: number | null;
  isActive: boolean;
}

/** Edits one slot, or creates the window on every chosen day; resolves to how many days already existed */
async function submitSlot(storeId: string, slot: DeliverySlot | undefined, days: number[], fields: SlotFields): Promise<number> {
  if (slot) {
    await api.patch(`/api/v1/delivery-slots/${slot.id}`, { ...fields, dayOfWeek: days[0] });
    return 0;
  }
  const results = await Promise.allSettled(days.map((dayOfWeek) => api.post("/api/v1/delivery-slots", { storeId, dayOfWeek, ...fields })));
  const failed = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
  if (failed.length === results.length) throw failed[0].reason;
  return failed.length;
}

export function SlotForm({ storeId, slot }: SlotFormProps) {
  const router = useRouter();
  const toast = useToast();
  const { run, running } = useAction();
  const [days, setDays] = useState<number[]>(slot ? [slot.dayOfWeek] : []);
  const [startTime, setStartTime] = useState<string | null>(slot?.startTime ?? null);
  const [endTime, setEndTime] = useState<string | null>(slot?.endTime ?? null);
  const [maxOrders, setMaxOrders] = useState(numberText(slot?.maxOrders ?? 20));
  const [cutoff, setCutoff] = useState(numberText(slot?.cutoffMinutes ?? 60));
  const [isActive, setIsActive] = useState(slot?.isActive ?? true);
  const save = async () => {
    const max = parseNumber(maxOrders);
    const cut = parseNumber(cutoff);
    const problem = validate(days, startTime, endTime, max, cut);
    if (problem) return toast.show(problem, "error");
    const fields = { startTime, endTime, maxOrders: max, cutoffMinutes: cut, isActive };
    const done = await run(() => submitSlot(storeId, slot, days, fields), slot ? "Slot updated" : "Slot saved");
    if (done === undefined) return;
    if (done > 0) toast.show(`${done} slot(s) already existed and were skipped`, "success");
    router.back();
  };
  const remove = async () => {
    if (!slot) return;
    const ok = await run(() => api.delete(`/api/v1/delivery-slots/${slot.id}`), "Slot deleted");
    if (ok !== undefined) router.back();
  };
  return (
    <ManageStackScreen title={slot ? "Edit time slot" : "New time slot"} actions={<Button label={slot ? "Save changes" : "Create slot"} onPress={save} loading={running} style={styles.flex} />}>
      <SectionCard title="Window">
        {slot
          ? <SelectField label="Day" value={String(days[0])} options={DAY_NAMES.map((n, i) => ({ value: String(i), label: n }))} onChange={(v) => setDays([Number(v)])} />
          : <DayChips value={days} onChange={setDays} />}
        <TimeSelect label="Start time" required value={startTime} onChange={setStartTime} />
        <TimeSelect label="End time" required value={endTime} onChange={setEndTime} />
      </SectionCard>
      <SectionCard title="Capacity">
        <TextField label="Max orders per slot" required keyboardType="number-pad" value={maxOrders} onChangeText={setMaxOrders} />
        <TextField label="Cutoff" required keyboardType="number-pad" suffix="min" hint="Ordering closes this many minutes before the slot starts" value={cutoff} onChangeText={setCutoff} />
        <SwitchRow label="Active" description="Inactive slots are hidden from customers" value={isActive} onValueChange={setIsActive} />
      </SectionCard>
      {slot && (
        <SectionCard title="Danger zone">
          <DeleteAction title="Delete this slot?" message="Customers will no longer be able to book this window." loading={running} onConfirm={remove} />
        </SectionCard>
      )}
    </ManageStackScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minWidth: 48, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: manage.line, backgroundColor: manage.card },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  chipTextOn: { color: "#fff", fontFamily: fonts.bold },
});
