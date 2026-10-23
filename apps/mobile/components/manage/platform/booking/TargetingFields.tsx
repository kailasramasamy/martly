import { View } from "react-native";
import { INDIAN_STATES } from "@martly/shared/constants";
import { SectionCard } from "../../ui/SectionCard";
import { SegmentedTabs } from "../../ui/SegmentedTabs";
import { FieldFrame } from "../../ui/FieldFrame";
import type { SelectOption } from "../../ui/OptionSheet";
import { MultiSelectField } from "./MultiSelectField";
import type { FormState, TargetMode } from "./form-state";

const MODES: { value: TargetMode; label: string }[] = [
  { value: "ALL", label: "All stores" },
  { value: "REGIONS", label: "Regions" },
  { value: "STORES", label: "Selected stores" },
];
const STATE_OPTIONS = INDIAN_STATES.map((s) => ({ value: s, label: s }));

interface Props {
  state: FormState;
  districts: SelectOption[];
  stores: SelectOption[];
  onChange: (patch: Partial<FormState>) => void;
}

/** Where the campaign runs: everywhere, certain states and districts, or chosen stores */
export function TargetingFields({ state, districts, stores, onChange }: Props) {
  return (
    <SectionCard title="Where it runs">
      <FieldFrame hint="Runs only in stores that stock the brand">
        <SegmentedTabs options={MODES} value={state.targetMode} onChange={(targetMode) => onChange({ targetMode })} />
      </FieldFrame>
      {state.targetMode === "REGIONS" ? (
        <View>
          <MultiSelectField label="States" options={STATE_OPTIONS} value={state.states} onChange={(states) => onChange({ states })} placeholder="Any state" />
          <MultiSelectField label="Districts" options={districts} value={state.districts} onChange={(next) => onChange({ districts: next })} placeholder="Any district" />
        </View>
      ) : null}
      {state.targetMode === "STORES" ? (
        <MultiSelectField label="Stores" options={stores} value={state.storeIds} onChange={(storeIds) => onChange({ storeIds })} placeholder="Choose stores" />
      ) : null}
    </SectionCard>
  );
}
