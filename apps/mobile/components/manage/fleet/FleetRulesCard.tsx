import { useState } from "react";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import { useToast } from "../../../lib/toast-context";
import type { FleetSettings } from "../delivery/plan/types";
import { Button } from "../ui/Button";
import { SectionCard } from "../ui/SectionCard";
import { SwitchRow } from "../ui/SwitchRow";
import { TextField } from "../ui/TextField";

type NumericKey = Exclude<keyof FleetSettings, "autoPlan">;

const FIELDS: { key: NumericKey; label: string; hint: string; suffix?: string; min: number; max: number }[] = [
  { key: "maxOrdersPerTrip", label: "Orders per trip", hint: "A trip never carries more than this many orders", min: 1, max: 30 },
  { key: "maxTripsPerRider", label: "Trips per rider, per slot", hint: "Caps how many trips one rider takes in a delivery window", min: 1, max: 10 },
  { key: "expressBatchSize", label: "Express batch size", hint: "Express orders are grouped once this many are ready", min: 1, max: 10 },
  { key: "expressMaxWaitMinutes", label: "Express max wait", hint: "Send ready Express orders after the oldest has waited this long", suffix: "min", min: 0, max: 120 },
];

interface FleetRulesCardProps {
  storeId: string;
  settings: FleetSettings;
  onSaved: () => void;
}

/** How big trips get and when planning happens by itself */
export function FleetRulesCard({ storeId, settings, onSaved }: FleetRulesCardProps) {
  const toast = useToast();
  const { run, running } = useAction();
  const [values, setValues] = useState(() => Object.fromEntries(FIELDS.map((f) => [f.key, String(settings[f.key])])) as Record<NumericKey, string>);
  const [autoPlan, setAutoPlan] = useState(settings.autoPlan);

  const save = async () => {
    const parsed: Partial<Record<NumericKey, number>> = {};
    for (const f of FIELDS) {
      const n = Number(values[f.key]);
      if (values[f.key].trim() === "" || !Number.isInteger(n) || n < f.min || n > f.max) {
        return toast.show(`${f.label} must be a whole number from ${f.min} to ${f.max}`, "error");
      }
      parsed[f.key] = n;
    }
    const saved = await run(() => api.put("/api/v1/delivery-plan/settings", { storeId, ...parsed, autoPlan }), "Fleet rules saved");
    if (saved) onSaved();
  };

  return (
    <SectionCard title="Fleet rules">
      {FIELDS.map((f) => (
        <TextField
          key={f.key} label={f.label} hint={f.hint} suffix={f.suffix} keyboardType="number-pad"
          value={values[f.key]} onChangeText={(text) => setValues((v) => ({ ...v, [f.key]: text }))}
        />
      ))}
      <SwitchRow
        label="Auto-plan"
        description="Plan each slot automatically at its cutoff and batch express orders"
        value={autoPlan}
        onValueChange={setAutoPlan}
      />
      <Button label="Save rules" onPress={save} loading={running} />
    </SectionCard>
  );
}
