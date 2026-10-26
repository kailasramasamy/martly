import { View } from "react-native";
import { TextField } from "../ui/TextField";
import { DateField } from "../ui/DateField";
import { SegmentedTabs } from "../ui/SegmentedTabs";
import type { DiscountDraft, DiscountMode } from "./draft";

const MODES: { value: DiscountMode; label: string }[] = [
  { value: "NONE", label: "No discount" },
  { value: "FLAT", label: "Flat ₹" },
  { value: "PERCENTAGE", label: "Percent %" },
];

interface DiscountFieldsProps {
  draft: DiscountDraft;
  onChange: (patch: Partial<DiscountDraft>) => void;
  /** Start/end dates are only shown in the full editor */
  withDates?: boolean;
}

export function DiscountFields({ draft, onChange, withDates }: DiscountFieldsProps) {
  const isFlat = draft.discountMode === "FLAT";
  return (
    <View style={{ gap: 10 }}>
      <SegmentedTabs options={MODES} value={draft.discountMode} onChange={(discountMode) => onChange({ discountMode })} />
      {draft.discountMode !== "NONE" && (
        <TextField
          label="Discount value"
          value={draft.discountValue}
          onChangeText={(discountValue) => onChange({ discountValue })}
          keyboardType="decimal-pad"
          prefix={isFlat ? "₹" : undefined}
          suffix={isFlat ? undefined : "%"}
        />
      )}
      {withDates && draft.discountMode !== "NONE" && (
        <>
          <DateField label="Starts" value={draft.discountStart} onChange={(discountStart) => onChange({ discountStart })} placeholder="Immediately" />
          <DateField label="Ends" value={draft.discountEnd} onChange={(discountEnd) => onChange({ discountEnd })} placeholder="No end date" minDate={draft.discountStart ?? undefined} />
        </>
      )}
    </View>
  );
}
