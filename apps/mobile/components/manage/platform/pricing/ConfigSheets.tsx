import { useState } from "react";
import { BannerPlacementLabels, INDIAN_STATES } from "@martly/shared/constants";
import { BottomSheet } from "../../../search/BottomSheet";
import { TextField } from "../../ui/TextField";
import { SelectField } from "../../ui/SelectField";
import { Button } from "../../ui/Button";
import { NumberField } from "./NumberField";
import { soldPlacements } from "./ConfigCards";
import type { AdProduct, PricingConfig, SlotLimits } from "./types";

const STATE_OPTIONS = INDIAN_STATES.map((s) => ({ value: s, label: s }));
const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/;

interface SheetProps {
  visible: boolean;
  config: PricingConfig;
  saving: boolean;
  onSave: (config: PricingConfig) => void;
  onClose: () => void;
}

type Errors = Record<string, string>;

const wholeBetween = (v: number, min: number, max: number) => Number.isInteger(v) && v >= min && v <= max;

function validateLimits(c: PricingConfig, placements: string[]): Errors {
  const errors: Errors = {};
  if (!wholeBetween(c.featuredBrandSlots, 0, 20)) errors.featuredBrandSlots = "Enter 0 to 20";
  for (const placement of placements) {
    const cap = c.slotLimits[placement]?.BRAND;
    if (typeof cap === "number" && !wholeBetween(cap, 0, 20)) errors[placement] = "Enter 0 to 20";
  }
  return errors;
}

export function LimitsEditSheet({ visible, config, products, saving, onSave, onClose }: SheetProps & { products: AdProduct[] }) {
  const [draft, setDraft] = useState(config);
  const [errors, setErrors] = useState<Errors>({});
  const placements = soldPlacements(products);
  const setCap = (placement: string, cap: number | null) => {
    const slotLimits: SlotLimits = { ...draft.slotLimits, [placement]: { BRAND: cap } };
    setDraft({ ...draft, slotLimits });
  };
  const submit = () => {
    const found = validateLimits(draft, placements);
    setErrors(found);
    if (Object.keys(found).length === 0) onSave(draft);
  };
  return (
    <BottomSheet visible={visible} title="Edit limits" onClose={onClose} scrollable footer={<Button label="Save" onPress={submit} loading={saving} />}>
      {placements.map((placement) => (
        <NumberField
          key={placement}
          label={BannerPlacementLabels[placement as keyof typeof BannerPlacementLabels]}
          integer
          placeholder="No limit"
          value={draft.slotLimits[placement]?.BRAND ?? null}
          onChange={(v) => setCap(placement, v)}
          error={errors[placement]}
        />
      ))}
      <NumberField
        label="Featured brands per category at once"
        integer
        value={Number.isNaN(draft.featuredBrandSlots) ? null : draft.featuredBrandSlots}
        onChange={(v) => setDraft({ ...draft, featuredBrandSlots: v ?? Number.NaN })}
        error={errors.featuredBrandSlots}
        hint="Brand campaigns running at once per placement. Leave a placement empty for no limit."
      />
    </BottomSheet>
  );
}

function validateInvoicing(c: PricingConfig): Errors {
  const errors: Errors = {};
  if (!Number.isFinite(c.gstPercent) || c.gstPercent < 0 || c.gstPercent > 28) errors.gstPercent = "Enter 0 to 28";
  if (!wholeBetween(c.freeRegenerations, 0, 10)) errors.freeRegenerations = "Enter 0 to 10";
  if (!/^[A-Z0-9]{1,10}$/.test(c.invoicePrefix.trim())) errors.invoicePrefix = "Up to 10 capitals or digits";
  if (c.sellerName.trim().length < 2) errors.sellerName = "Required";
  if (c.sellerGstin && !GSTIN.test(c.sellerGstin)) errors.sellerGstin = "Enter a valid GSTIN";
  if (!c.sellerState) errors.sellerState = "Required";
  if ((c.sellerAddress ?? "").length > 400) errors.sellerAddress = "Up to 400 characters";
  return errors;
}

export function InvoicingEditSheet({ visible, config, saving, onSave, onClose }: SheetProps) {
  const [draft, setDraft] = useState(config);
  const [errors, setErrors] = useState<Errors>({});
  const set = (change: Partial<PricingConfig>) => setDraft((prev) => ({ ...prev, ...change }));
  const submit = () => {
    const found = validateInvoicing(draft);
    setErrors(found);
    if (Object.keys(found).length === 0) onSave({ ...draft, invoicePrefix: draft.invoicePrefix.trim(), sellerName: draft.sellerName.trim(), sellerAddress: draft.sellerAddress?.trim() || null });
  };
  return (
    <BottomSheet visible={visible} title="Edit invoicing" onClose={onClose} scrollable footer={<Button label="Save" onPress={submit} loading={saving} />}>
      <NumberField label="GST %" suffix="%" value={Number.isNaN(draft.gstPercent) ? null : draft.gstPercent} onChange={(v) => set({ gstPercent: v ?? Number.NaN })} error={errors.gstPercent} />
      <NumberField label="Free AI redrafts per promotion" integer value={Number.isNaN(draft.freeRegenerations) ? null : draft.freeRegenerations} onChange={(v) => set({ freeRegenerations: v ?? Number.NaN })} error={errors.freeRegenerations} />
      <TextField label="Invoice prefix" required value={draft.invoicePrefix} onChangeText={(t) => set({ invoicePrefix: t.toUpperCase() })} maxLength={10} autoCapitalize="characters" error={errors.invoicePrefix} />
      <TextField label="Seller name" required value={draft.sellerName} onChangeText={(sellerName) => set({ sellerName })} maxLength={120} error={errors.sellerName} />
      <TextField label="Seller GSTIN" value={draft.sellerGstin ?? ""} onChangeText={(t) => set({ sellerGstin: t.toUpperCase() || null })} maxLength={15} autoCapitalize="characters" error={errors.sellerGstin} />
      <SelectField label="Seller state" required value={draft.sellerState} options={STATE_OPTIONS} onChange={(sellerState) => set({ sellerState })} error={errors.sellerState} />
      <TextField label="Seller address" value={draft.sellerAddress ?? ""} onChangeText={(t) => set({ sellerAddress: t })} multiline maxLength={400} error={errors.sellerAddress} />
    </BottomSheet>
  );
}
