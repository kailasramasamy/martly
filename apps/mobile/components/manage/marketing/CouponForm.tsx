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
import { DeleteButton, OptionalDate, endOfDayIso, isoToDateKey, numberText, parseNumber, startOfDayIso } from "./common";
import type { Coupon } from "./types";

const TYPE_OPTIONS = [
  { value: "PERCENTAGE", label: "Percentage (%)" },
  { value: "FLAT", label: "Flat amount (₹)" },
];

interface FormState {
  code: string;
  title: string;
  showOnHome: boolean;
  description: string;
  discountType: string;
  discountValue: string;
  maxDiscount: string;
  minOrderAmount: string;
  usageLimit: string;
  perUserLimit: string;
  startsAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
}

const EMPTY: FormState = {
  code: "", title: "", showOnHome: false, description: "", discountType: "PERCENTAGE", discountValue: "", maxDiscount: "", minOrderAmount: "",
  usageLimit: "", perUserLimit: "1", startsAt: null, expiresAt: null, isActive: true,
};

const fromCoupon = (c: Coupon): FormState => ({
  code: c.code,
  title: c.title ?? "",
  showOnHome: c.showOnHome,
  description: c.description ?? "",
  discountType: c.discountType,
  discountValue: numberText(c.discountValue),
  maxDiscount: numberText(c.maxDiscount),
  minOrderAmount: numberText(c.minOrderAmount),
  usageLimit: numberText(c.usageLimit),
  perUserLimit: numberText(c.perUserLimit),
  startsAt: isoToDateKey(c.startsAt),
  expiresAt: isoToDateKey(c.expiresAt),
  isActive: c.isActive,
});

function validate(f: FormState): Partial<Record<keyof FormState, string>> {
  const errors: Partial<Record<keyof FormState, string>> = {};
  if (!f.code.trim()) errors.code = "Enter a code";
  const value = parseNumber(f.discountValue);
  if (!value || value <= 0) errors.discountValue = "Enter a value above 0";
  else if (f.discountType === "PERCENTAGE" && value > 100) errors.discountValue = "Percentage can't exceed 100";
  const perUser = parseNumber(f.perUserLimit);
  if (!perUser || perUser < 1 || !Number.isInteger(perUser)) errors.perUserLimit = "Enter a whole number, 1 or more";
  const limit = parseNumber(f.usageLimit);
  if (f.usageLimit && (!limit || limit < 1 || !Number.isInteger(limit))) errors.usageLimit = "Enter a whole number, 1 or more";
  if (f.startsAt && f.expiresAt && f.expiresAt < f.startsAt) errors.expiresAt = "Must be on or after the start date";
  return errors;
}

function toPayload(f: FormState) {
  return {
    code: f.code.trim().toUpperCase(),
    title: f.title.trim() || null,
    showOnHome: f.showOnHome,
    description: f.description.trim() || null,
    discountType: f.discountType,
    discountValue: parseNumber(f.discountValue),
    maxDiscount: parseNumber(f.maxDiscount),
    minOrderAmount: parseNumber(f.minOrderAmount),
    usageLimit: parseNumber(f.usageLimit),
    perUserLimit: parseNumber(f.perUserLimit),
    startsAt: f.startsAt ? startOfDayIso(f.startsAt) : null,
    expiresAt: f.expiresAt ? endOfDayIso(f.expiresAt) : null,
    isActive: f.isActive,
  };
}

export function CouponForm({ id }: { id?: string }) {
  const router = useRouter();
  const { organizationId } = useManageScope();
  const { data, loading, error, reload } = useResource<Coupon>(id ? `/api/v1/coupons/${id}` : null);
  const { run, running } = useAction();

  if (id && !data) {
    return <ManageStackScreen title="Edit coupon" loading={loading} error={error} onRetry={reload}>{null}</ManageStackScreen>;
  }
  return <CouponFields key={data?.id} initial={data ? fromCoupon(data) : EMPTY} id={id} onDone={() => router.back()} run={run} running={running} orgId={organizationId} />;
}

interface FieldsProps {
  initial: FormState;
  id?: string;
  orgId?: string;
  onDone: () => void;
  run: ReturnType<typeof useAction>["run"];
  running: boolean;
}

function CouponFields({ initial, id, orgId, onDone, run, running }: FieldsProps) {
  const [f, setF] = useState(initial);
  const [errors, setErrors] = useState<ReturnType<typeof validate>>({});
  const set = <K extends keyof FormState>(key: K) => (value: FormState[K]) => setF((prev) => ({ ...prev, [key]: value }));
  const percent = f.discountType === "PERCENTAGE";

  const save = async () => {
    const found = validate(f);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const body = { ...toPayload(f), ...(id ? {} : { organizationId: orgId }) };
    const result = await run(() => (id ? api.put(`/api/v1/coupons/${id}`, body) : api.post("/api/v1/coupons", body)), id ? "Coupon updated" : "Coupon created");
    if (result) onDone();
  };

  const actions = (
    <View style={styles.actions}>
      {id ? <DeleteButton title="Delete coupon?" message={`${f.code} will stop working immediately. Past redemptions are removed with it.`} running={running} onConfirm={async () => { if (await run(() => api.delete(`/api/v1/coupons/${id}`), "Coupon deleted")) onDone(); }} /> : null}
      <Button label={id ? "Save changes" : "Create coupon"} onPress={save} loading={running} style={styles.save} />
    </View>
  );

  return (
    <ManageStackScreen title={id ? "Edit coupon" : "New coupon"} actions={actions}>
      <SectionCard title="Coupon">
        <TextField label="Code" required value={f.code} onChangeText={(t) => set("code")(t.toUpperCase())} autoCapitalize="characters" placeholder="WELCOME10" error={errors.code} />
        <TextField label="Description" value={f.description} onChangeText={set("description")} placeholder="Optional" />
        <SwitchRow label="Active" value={f.isActive} onValueChange={set("isActive")} />
      </SectionCard>
      <SectionCard title="Home offers">
        <SwitchRow label="Show in Home offers" description="Advertise in Home offers and checkout" value={f.showOnHome} onValueChange={set("showOnHome")} />
        <TextField label="Offer headline" value={f.title} onChangeText={set("title")} maxLength={40} placeholder="Flat ₹50 off" hint="Shown on the offer card; made from the discount if empty" />
      </SectionCard>
      <SectionCard title="Discount">
        <SelectField label="Type" required value={f.discountType} options={TYPE_OPTIONS} onChange={set("discountType")} />
        <TextField label="Value" required value={f.discountValue} onChangeText={set("discountValue")} keyboardType="decimal-pad" suffix={percent ? "%" : undefined} prefix={percent ? undefined : "₹"} hint={percent ? "10 means 10% off" : undefined} error={errors.discountValue} />
        <TextField label="Max discount cap" value={f.maxDiscount} onChangeText={set("maxDiscount")} keyboardType="decimal-pad" prefix={"₹"} hint="Caps the discount on percentage coupons" />
        <TextField label="Min order amount" value={f.minOrderAmount} onChangeText={set("minOrderAmount")} keyboardType="decimal-pad" prefix={"₹"} />
      </SectionCard>
      <SectionCard title="Limits and validity">
        <TextField label="Total usage limit" value={f.usageLimit} onChangeText={set("usageLimit")} keyboardType="number-pad" hint="Leave empty for unlimited" error={errors.usageLimit} />
        <TextField label="Per-user limit" required value={f.perUserLimit} onChangeText={set("perUserLimit")} keyboardType="number-pad" error={errors.perUserLimit} />
        <OptionalDate label="Starts" value={f.startsAt} onChange={set("startsAt")} placeholder="Immediately" />
        <OptionalDate label="Expires" value={f.expiresAt} onChange={set("expiresAt")} placeholder="No expiry" minDate={f.startsAt ?? undefined} error={errors.expiresAt} />
      </SectionCard>
    </ManageStackScreen>
  );
}

const styles = StyleSheet.create({
  actions: { flex: 1, flexDirection: "row", gap: 10 },
  save: { flex: 2 },
});
