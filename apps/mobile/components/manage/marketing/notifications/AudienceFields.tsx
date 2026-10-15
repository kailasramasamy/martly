import { AudienceTypeLabels } from "@martly/shared/constants";
import { SelectField } from "../../ui/SelectField";
import { TextField } from "../../ui/TextField";
import { KeyValue } from "../../ui/KeyValue";
import { useManageScope } from "../../../../lib/manage-scope-context";
import { audienceConfigOf, useAudienceCount, type Compose } from "./compose";

const DESCRIPTIONS: Record<string, string> = {
  ALL_CUSTOMERS: "Everyone who has ordered from your stores",
  STORE_CUSTOMERS: "Customers of one store",
  ORDERED_LAST_N_DAYS: "Ordered in the last N days",
  NOT_ORDERED_N_DAYS: "Win-back: haven't ordered in N days",
  HIGH_VALUE_CUSTOMERS: "Total spend above a threshold",
};
const AUDIENCE_OPTIONS = Object.entries(AudienceTypeLabels).map(([value, label]) => ({ value, label, description: DESCRIPTIONS[value] }));

interface Props {
  value: Compose;
  onChange: (patch: Partial<Compose>) => void;
  errors: Partial<Record<keyof Compose, string>>;
}

export function AudienceFields({ value, onChange, errors }: Props) {
  const { stores } = useManageScope();
  const { count, loading } = useAudienceCount(value.audienceType, audienceConfigOf(value));
  const type = value.audienceType;
  return (
    <>
      <SelectField label="Audience" value={type} options={AUDIENCE_OPTIONS} onChange={(audienceType) => onChange({ audienceType })} />
      {type === "STORE_CUSTOMERS" ? (
        <SelectField label="Store" required value={value.storeId} options={stores.map((s) => ({ value: s.id, label: s.name }))} onChange={(storeId) => onChange({ storeId })} error={errors.storeId} />
      ) : null}
      {type === "ORDERED_LAST_N_DAYS" || type === "NOT_ORDERED_N_DAYS" ? (
        <TextField label={type === "ORDERED_LAST_N_DAYS" ? "Ordered in the last N days" : "Not ordered in the last N days"} value={value.days} onChangeText={(days) => onChange({ days })} keyboardType="number-pad" />
      ) : null}
      {type === "HIGH_VALUE_CUSTOMERS" ? (
        <TextField label="Minimum total spend" value={value.minAmount} onChangeText={(minAmount) => onChange({ minAmount })} keyboardType="number-pad" prefix={"₹"} />
      ) : null}
      <KeyValue label="Estimated reach" value={loading ? "Counting..." : count === null ? "Unavailable" : `${count.toLocaleString("en-IN")} customers`} emphasis />
    </>
  );
}
