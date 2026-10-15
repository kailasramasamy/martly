import { useState } from "react";
import { StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import { useToast } from "../../../lib/toast-context";
import { SectionCard } from "../ui/SectionCard";
import { TextField } from "../ui/TextField";
import { SwitchRow } from "../ui/SwitchRow";
import { Button } from "../ui/Button";
import { ManageStackScreen } from "../ManageStackScreen";
import { DeleteAction } from "./DeleteAction";
import { numberText, parseNumber } from "./numbers";
import type { DeliveryTier } from "./types";

function validate(min: number | null, max: number | null, fee: number | null, eta: number | null): string | null {
  if (min === null || Number.isNaN(min) || min < 0) return "Min distance must be 0 or more";
  if (max === null || Number.isNaN(max) || max <= 0) return "Max distance must be more than 0";
  if (min >= max) return "Min distance must be less than max distance";
  if (fee === null || Number.isNaN(fee) || fee < 0) return "Enter a delivery fee (0 for free)";
  if (eta === null || !Number.isInteger(eta) || eta < 1) return "Estimated time must be a whole number of minutes";
  return null;
}

export function TierForm({ storeId, tier }: { storeId: string; tier?: DeliveryTier }) {
  const router = useRouter();
  const toast = useToast();
  const { run, running } = useAction();
  const [minD, setMinD] = useState(numberText(tier?.minDistance));
  const [maxD, setMaxD] = useState(numberText(tier?.maxDistance));
  const [fee, setFee] = useState(numberText(tier ? Number(tier.deliveryFee) : undefined));
  const [eta, setEta] = useState(numberText(tier?.estimatedMinutes ?? 45));
  const [isActive, setIsActive] = useState(tier?.isActive ?? true);

  const save = async () => {
    const [min, max, deliveryFee, estimatedMinutes] = [minD, maxD, fee, eta].map(parseNumber);
    const problem = validate(min, max, deliveryFee, estimatedMinutes);
    if (problem) return toast.show(problem, "error");
    const fields = { minDistance: min, maxDistance: max, deliveryFee, estimatedMinutes, isActive };
    const done = await run(
      () => (tier ? api.put(`/api/v1/delivery-tiers/${tier.id}`, fields) : api.post("/api/v1/delivery-tiers", { storeId, ...fields })),
      tier ? "Tier updated" : "Tier created",
    );
    if (done) router.back();
  };

  const remove = async () => {
    if (!tier) return;
    const done = await run(() => api.delete(`/api/v1/delivery-tiers/${tier.id}`), "Tier deleted");
    if (done) router.back();
  };

  return (
    <ManageStackScreen
      title={tier ? "Edit delivery tier" : "New delivery tier"}
      actions={<Button label={tier ? "Save changes" : "Create tier"} onPress={save} loading={running} style={styles.flex} />}
    >
      <SectionCard title="Distance band">
        <TextField label="From" required suffix="km" keyboardType="decimal-pad" value={minD} onChangeText={setMinD} />
        <TextField label="Up to" required suffix="km" keyboardType="decimal-pad" hint="Bands within a store cannot overlap" value={maxD} onChangeText={setMaxD} />
      </SectionCard>
      <SectionCard title="Charge">
        <TextField label="Delivery fee" required prefix={"₹"} keyboardType="decimal-pad" value={fee} onChangeText={setFee} />
        <TextField label="Estimated delivery time" required suffix="min" keyboardType="number-pad" value={eta} onChangeText={setEta} />
        <SwitchRow label="Active" description="Inactive tiers are skipped when pricing delivery" value={isActive} onValueChange={setIsActive} />
      </SectionCard>
      {tier && (
        <SectionCard title="Danger zone">
          <DeleteAction title="Delete this tier?" message="Addresses in this distance band will no longer be serviceable." loading={running} onConfirm={remove} />
        </SectionCard>
      )}
    </ManageStackScreen>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
