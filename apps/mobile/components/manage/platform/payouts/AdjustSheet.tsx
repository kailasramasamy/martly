import { useEffect, useMemo, useState } from "react";
import { ledgerAdjustmentSchema } from "@martly/shared/schemas";
import { useResource } from "../../../../lib/manage/use-resource";
import { BottomSheet } from "../../../search/BottomSheet";
import { TextField } from "../../ui/TextField";
import { SelectField } from "../../ui/SelectField";
import { SegmentedTabs } from "../../ui/SegmentedTabs";
import { Button } from "../../ui/Button";
import { parseNumber } from "../../marketing/common";
import type { Option } from "./types";

type Direction = "pay" | "charge";

const DIRECTIONS: { value: Direction; label: string }[] = [{ value: "pay", label: "Pay the store" }, { value: "charge", label: "Charge the store" }];

interface Props {
  visible: boolean;
  orgs: Option[];
  running: boolean;
  onSubmit: (input: unknown) => void;
  onClose: () => void;
}

/** Record a manual ledger adjustment; the owner sees the reason in their ledger */
export function AdjustSheet({ visible, orgs, running, onSubmit, onClose }: Props) {
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [direction, setDirection] = useState<Direction>("pay");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<{ field: string; message: string } | null>(null);
  const stores = useResource<{ id: string; name: string }[]>(organizationId ? `/api/v1/stores?organizationId=${organizationId}&pageSize=100` : null);
  const storeOptions = useMemo(() => (stores.data ?? []).map((s) => ({ value: s.id, label: s.name })), [stores.data]);

  useEffect(() => setStoreId(null), [organizationId]);

  const submit = () => {
    const n = parseNumber(amount) ?? 0;
    const parsed = ledgerAdjustmentSchema.safeParse({ organizationId: organizationId ?? "", storeId: storeId ?? undefined, amount: direction === "pay" ? n : -n, reason });
    if (!parsed.success) return setError({ field: String(parsed.error.issues[0].path[0]), message: parsed.error.issues[0].message });
    setError(null);
    onSubmit(parsed.data);
  };

  return (
    <BottomSheet visible={visible} title="Record adjustment" onClose={onClose} scrollable footer={<Button label="Record adjustment" onPress={submit} loading={running} />}>
      <SelectField label="Organization" required value={organizationId} options={orgs} onChange={setOrganizationId} placeholder="Choose an organization" />
      <SelectField label="Store (optional)" value={storeId} options={storeOptions} onChange={setStoreId} disabled={!organizationId} placeholder="All stores" />
      <SegmentedTabs options={DIRECTIONS} value={direction} onChange={setDirection} />
      <TextField label="Amount" required value={amount} onChangeText={setAmount} prefix={"₹"} keyboardType="decimal-pad" error={error && error.field !== "reason" ? error.message : undefined} />
      <TextField label="Reason" required value={reason} onChangeText={setReason} multiline maxLength={300} hint="The owner sees this in their ledger" error={error?.field === "reason" ? error.message : undefined} />
    </BottomSheet>
  );
}
