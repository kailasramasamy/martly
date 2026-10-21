import { Text, StyleSheet } from "react-native";
import { SectionCard } from "../ui/SectionCard";
import { TextField } from "../ui/TextField";
import { SelectField } from "../ui/SelectField";
import type { SelectOption } from "../ui/OptionSheet";
import { SwitchRow } from "../ui/SwitchRow";
import { TimeSelect } from "../delivery-config/TimeSelect";
import { parseNumber } from "../delivery-config/numbers";
import { LocationPicker } from "./LocationPicker";
import { colors, fonts } from "../../../constants/theme";
import { STORE_STATUS_OPTIONS } from "./constants";
import { INDIAN_STATES } from "@martly/shared/constants";
import { useAuth } from "../../../lib/auth-context";
import { slugify, type StoreDraft } from "./store-draft";

interface CardProps {
  draft: StoreDraft;
  set: (patch: Partial<StoreDraft>) => void;
}

interface StoreFormFieldsProps extends CardProps {
  creating: boolean;
  /** Organization choices; only passed for SUPER_ADMIN creating a store */
  orgOptions?: SelectOption[];
}

const SUBSCRIPTION_MODES: SelectOption[] = [
  { value: "DEDICATED", label: "Dedicated window" },
  { value: "SLOT_BASED", label: "Regular slots" },
];

function DetailsCard({ draft, set, creating, orgOptions }: StoreFormFieldsProps) {
  const rename = (name: string) => set(creating && draft.slug === slugify(draft.name) ? { name, slug: slugify(name) } : { name });
  return (
    <SectionCard title="Store details">
      {orgOptions && <SelectField label="Organization" required value={draft.organizationId || null} options={orgOptions} onChange={(organizationId) => set({ organizationId })} />}
      <TextField label="Name" required value={draft.name} onChangeText={rename} />
      <TextField label="Slug" required autoCapitalize="none" hint="Lowercase letters, numbers and hyphens" value={draft.slug} onChangeText={(slug) => set({ slug })} />
      {!creating && <SelectField label="Status" required value={draft.status} options={STORE_STATUS_OPTIONS} onChange={(status) => set({ status })} />}
    </SectionCard>
  );
}

function LocationCard({ draft, set }: CardProps) {
  const lat = parseNumber(draft.latitude);
  const lng = parseNumber(draft.longitude);
  return (
    <SectionCard title="Contact & location">
      <TextField label="Address" required multiline value={draft.address} onChangeText={(address) => set({ address })} />
      <TextField label="Phone" keyboardType="phone-pad" value={draft.phone} onChangeText={(phone) => set({ phone })} />
      <TextField label="Latitude" keyboardType="numbers-and-punctuation" placeholder="e.g. 12.0712" value={draft.latitude} onChangeText={(latitude) => set({ latitude })} />
      <TextField label="Longitude" keyboardType="numbers-and-punctuation" placeholder="e.g. 78.4851" value={draft.longitude} onChangeText={(longitude) => set({ longitude })} />
      <LocationPicker latitude={lat} longitude={lng} onPick={(la, lo) => set({ latitude: String(la), longitude: String(lo) })} />
    </SectionCard>
  );
}

const STATE_OPTIONS: SelectOption[] = INDIAN_STATES.map((s) => ({ value: s, label: s }));

function RegionCard({ draft, set }: CardProps) {
  const { user } = useAuth();
  if (user?.role === "SUPER_ADMIN") {
    return (
      <SectionCard title="Region">
        <SelectField label="State" value={draft.state} options={STATE_OPTIONS} onChange={(state) => set({ state })} />
        <TextField label="District" value={draft.district} onChangeText={(district) => set({ district })} />
      </SectionCard>
    );
  }
  if (!draft.state) return null;
  const region = [draft.district, draft.state].filter(Boolean).join(", ");
  return <Text style={styles.note}>{`Region: ${region} \u00B7 set by Martly`}</Text>;
}

function DeliveryCard({ draft, set }: CardProps) {
  return (
    <SectionCard title="Delivery settings">
      <TextField label="Delivery radius" suffix="km" keyboardType="decimal-pad" value={draft.deliveryRadius} onChangeText={(deliveryRadius) => set({ deliveryRadius })} />
      <TextField label="Base delivery fee" prefix={"₹"} keyboardType="decimal-pad" placeholder="No base fee" hint="Used when no distance tier or zone matches" value={draft.baseDeliveryFee} onChangeText={(baseDeliveryFee) => set({ baseDeliveryFee })} />
      <TextField label="Free delivery above" prefix={"₹"} keyboardType="decimal-pad" placeholder="No threshold" value={draft.freeDeliveryThreshold} onChangeText={(freeDeliveryThreshold) => set({ freeDeliveryThreshold })} />
      <TextField label="Return keep-it limit" prefix={"₹"} keyboardType="decimal-pad" placeholder="No limit" hint="Returns worth up to this amount are refunded without collecting the item." value={draft.returnKeepThreshold} onChangeText={(returnKeepThreshold) => set({ returnKeepThreshold })} />
      <TextField label="Minimum order amount" prefix={"₹"} keyboardType="decimal-pad" placeholder="No minimum" value={draft.minOrderAmount} onChangeText={(minOrderAmount) => set({ minOrderAmount })} />
    </SectionCard>
  );
}

function SubscriptionCard({ draft, set }: CardProps) {
  return (
    <SectionCard title="Subscriptions">
      <SwitchRow label="Enable subscriptions" value={draft.subscriptionEnabled} onValueChange={(subscriptionEnabled) => set({ subscriptionEnabled })} />
      <SelectField label="Delivery mode" value={draft.subscriptionDeliveryMode} options={SUBSCRIPTION_MODES} onChange={(subscriptionDeliveryMode) => set({ subscriptionDeliveryMode })} />
      <TimeSelect optional label="Window start" value={draft.subscriptionWindowStart} onChange={(subscriptionWindowStart) => set({ subscriptionWindowStart })} />
      <TimeSelect optional label="Window end" value={draft.subscriptionWindowEnd} onChange={(subscriptionWindowEnd) => set({ subscriptionWindowEnd })} />
      <TimeSelect label="Basket cutoff" hint="Time by which the basket is finalised" value={draft.subscriptionCutoffTime} onChange={(t) => set({ subscriptionCutoffTime: t ?? "22:00" })} />
    </SectionCard>
  );
}

export function StoreFormFields(props: StoreFormFieldsProps) {
  return (
    <>
      <DetailsCard {...props} />
      <LocationCard draft={props.draft} set={props.set} />
      <RegionCard draft={props.draft} set={props.set} />
      <DeliveryCard draft={props.draft} set={props.set} />
      {!props.creating && <SubscriptionCard draft={props.draft} set={props.set} />}
    </>
  );
}

const styles = StyleSheet.create({
  note: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, lineHeight: 18, paddingHorizontal: 4 },
});
