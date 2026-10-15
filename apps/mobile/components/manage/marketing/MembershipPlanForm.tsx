import { useState } from "react";
import { View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { ManageStackScreen } from "../ManageStackScreen";
import { SectionCard } from "../ui/SectionCard";
import { TextField } from "../ui/TextField";
import { SelectField } from "../ui/SelectField";
import { SwitchRow } from "../ui/SwitchRow";
import { Button } from "../ui/Button";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import { useResource } from "../../../lib/manage/use-resource";
import { useManageScope } from "../../../lib/manage-scope-context";
import { DeleteButton, numberText, parseNumber } from "./common";
import type { MembershipPlan } from "./loyalty-types";

export const DURATION_LABEL: Record<string, string> = { MONTHLY: "Monthly", QUARTERLY: "Quarterly", ANNUAL: "Annual" };
const DURATION_OPTIONS = [
  { value: "MONTHLY", label: "Monthly (30 days)" },
  { value: "QUARTERLY", label: "Quarterly (90 days)" },
  { value: "ANNUAL", label: "Annual (365 days)" },
];

interface FormState {
  name: string;
  description: string;
  price: string;
  duration: string;
  freeDelivery: boolean;
  loyaltyMultiplier: string;
  sortOrder: string;
  isActive: boolean;
}

const EMPTY: FormState = { name: "", description: "", price: "", duration: "MONTHLY", freeDelivery: true, loyaltyMultiplier: "1", sortOrder: "0", isActive: true };

const fromPlan = (p: MembershipPlan): FormState => ({
  name: p.name, description: p.description ?? "", price: numberText(p.price), duration: p.duration, freeDelivery: p.freeDelivery,
  loyaltyMultiplier: numberText(Number(p.loyaltyMultiplier)), sortOrder: numberText(p.sortOrder), isActive: p.isActive,
});

function validate(f: FormState): Partial<Record<keyof FormState, string>> {
  const errors: Partial<Record<keyof FormState, string>> = {};
  if (!f.name.trim()) errors.name = "Enter a plan name";
  const price = parseNumber(f.price);
  if (!price || price <= 0) errors.price = "Enter a price above 0";
  const mult = parseNumber(f.loyaltyMultiplier);
  if (mult === null || mult < 1 || mult > 10) errors.loyaltyMultiplier = "Between 1 and 10";
  const order = parseNumber(f.sortOrder);
  if (order === null || !Number.isInteger(order) || order < 0) errors.sortOrder = "Whole number, 0 or more";
  return errors;
}

export function MembershipPlanForm({ id }: { id?: string }) {
  const { data, loading, error, reload } = useResource<MembershipPlan[]>(id ? "/api/v1/memberships/plans?pageSize=100" : null);
  const plan = data?.find((p) => p.id === id);
  if (id && !plan) {
    return <ManageStackScreen title="Edit plan" loading={loading} error={error ?? (data ? "Plan not found" : null)} onRetry={reload}>{null}</ManageStackScreen>;
  }
  return <PlanFields key={plan?.id} initial={plan ? fromPlan(plan) : EMPTY} id={id} />;
}

function PlanFields({ initial, id }: { initial: FormState; id?: string }) {
  const router = useRouter();
  const { organizationId } = useManageScope();
  const { run, running } = useAction();
  const [f, setF] = useState(initial);
  const [errors, setErrors] = useState<ReturnType<typeof validate>>({});
  const set = <K extends keyof FormState>(key: K) => (value: FormState[K]) => setF((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    const found = validate(f);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const body = {
      name: f.name.trim(), description: f.description.trim() || null, price: Number(f.price), duration: f.duration,
      freeDelivery: f.freeDelivery, loyaltyMultiplier: Number(f.loyaltyMultiplier), sortOrder: Number(f.sortOrder), isActive: f.isActive,
    };
    const create = { ...body, description: body.description ?? undefined, organizationId };
    const result = await run(() => (id ? api.put(`/api/v1/memberships/plans/${id}`, body) : api.post("/api/v1/memberships/plans", create)), id ? "Plan updated" : "Plan created");
    if (result) router.back();
  };
  const deactivate = async () => {
    if (await run(() => api.delete(`/api/v1/memberships/plans/${id}`), "Plan deactivated")) router.back();
  };

  const actions = (
    <View style={styles.actions}>
      {id && initial.isActive ? <DeleteButton label="Deactivate" title="Deactivate plan?" message="This hides the plan from customers. Existing subscribers keep their membership." running={running} onConfirm={deactivate} /> : null}
      <Button label={id ? "Save changes" : "Create plan"} onPress={save} loading={running} style={styles.save} />
    </View>
  );

  return (
    <ManageStackScreen title={id ? "Edit plan" : "New plan"} actions={actions}>
      <SectionCard title="Plan">
        <TextField label="Plan name" required value={f.name} onChangeText={set("name")} placeholder="e.g. Mart Plus Monthly" maxLength={200} error={errors.name} />
        <TextField label="Description" value={f.description} onChangeText={set("description")} multiline maxLength={500} placeholder="Benefits description" />
        <TextField label="Price" required value={f.price} onChangeText={set("price")} keyboardType="decimal-pad" prefix={"₹"} error={errors.price} />
        <SelectField label="Duration" required value={f.duration} options={DURATION_OPTIONS} onChange={set("duration")} />
      </SectionCard>
      <SectionCard title="Benefits">
        <SwitchRow label="Free delivery" value={f.freeDelivery} onValueChange={set("freeDelivery")} />
        <TextField label="Loyalty points multiplier" value={f.loyaltyMultiplier} onChangeText={set("loyaltyMultiplier")} keyboardType="decimal-pad" suffix="x" hint="2 means double points on every order" error={errors.loyaltyMultiplier} />
      </SectionCard>
      <SectionCard title="Display">
        <TextField label="Sort order" value={f.sortOrder} onChangeText={set("sortOrder")} keyboardType="number-pad" error={errors.sortOrder} />
        <SwitchRow label="Active" value={f.isActive} onValueChange={set("isActive")} />
      </SectionCard>
    </ManageStackScreen>
  );
}

const styles = StyleSheet.create({
  actions: { flex: 1, flexDirection: "row", gap: 10 },
  save: { flex: 2 },
});
