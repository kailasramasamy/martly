import { Text, StyleSheet } from "react-native";
import { SectionCard } from "../ui/SectionCard";
import { SegmentedTabs } from "../ui/SegmentedTabs";
import { TextField } from "../ui/TextField";
import { SwitchRow } from "../ui/SwitchRow";
import { DateField } from "../ui/DateField";
import { toDateKey } from "../ui/dates";
import { colors, fonts } from "../../../constants/theme";
import { ImageSource } from "./ImageSource";
import { isDiscountable, type ManualPromoErrors, type ManualPromoState, type StartMode } from "./manual-promo";

type Patch = (patch: Partial<ManualPromoState>) => void;

const DISCOUNT_TABS = [{ value: "NONE", label: "None" }, { value: "PERCENTAGE", label: "Percent" }, { value: "FLAT", label: "Flat ₹" }] as const;
const START_TABS: { value: StartMode; label: string }[] = [{ value: "now", label: "Launch now" }, { value: "ready", label: "Save as ready" }, { value: "schedule", label: "Schedule" }];

interface DiscountProps {
  state: ManualPromoState;
  errors: ManualPromoErrors;
  onChange: Patch;
}

export function DiscountSection({ state, errors, onChange }: DiscountProps) {
  const enabled = isDiscountable(state.actionType);
  const symbol = state.discountType === "FLAT" ? "₹" : "%";
  return (
    <SectionCard title="Discount">
      <SegmentedTabs
        options={[...DISCOUNT_TABS]}
        value={state.discountType ?? "NONE"}
        onChange={(v) => enabled && onChange({ discountType: v === "NONE" ? null : v })}
      />
      {!enabled ? <Text style={styles.note}>A discount needs a category, product, collection or brand target.</Text> : null}
      {state.discountType ? (
        <TextField
          label="Discount value" required value={state.discountValue} onChangeText={(discountValue) => onChange({ discountValue })}
          keyboardType="decimal-pad" suffix={symbol} error={errors.discountValue} hint="Applies to every listed product the target covers"
        />
      ) : null}
    </SectionCard>
  );
}

interface ScheduleProps extends DiscountProps {
  pushAllowed: boolean;
}

export function ScheduleSection({ state, errors, onChange, pushAllowed }: ScheduleProps) {
  const tomorrow = toDateKey(new Date(Date.now() + 24 * 60 * 60 * 1000));
  return (
    <SectionCard title="Schedule">
      <TextField label="Runs for (days)" required value={state.durationDays} onChangeText={(durationDays) => onChange({ durationDays })} keyboardType="number-pad" error={errors.durationDays} />
      <SegmentedTabs options={START_TABS} value={state.start} onChange={(start) => onChange({ start })} />
      {state.start === "schedule" ? (
        <DateField label="Goes live on" value={state.launchDate} onChange={(launchDate) => onChange({ launchDate })} minDate={tomorrow} error={errors.launchDate} placeholder="Pick a date" />
      ) : null}
      {state.start === "ready" ? <Text style={styles.note}>It waits on the promotion page until you launch it.</Text> : null}
      <SwitchRow
        label="Notify customers" description={pushAllowed ? "One push per day at most" : "Push notifications come with Pro"}
        value={pushAllowed && state.notify} onValueChange={(notify) => onChange({ notify })} disabled={!pushAllowed}
      />
    </SectionCard>
  );
}

interface BannerProps {
  state: ManualPromoState;
  errors: ManualPromoErrors;
  onChange: Patch;
}

export function BannerImageSection({ state, errors, onChange }: BannerProps) {
  return (
    <SectionCard title="Banner image">
      <ImageSource
        imageUrl={state.imageUrl} onImage={(imageUrl) => onChange({ imageUrl })} error={errors.imageUrl}
        title={state.title} subtitle={state.subtitle} actionType={state.actionType} actionTarget={state.actionTarget}
        onGenerated={(art) => onChange({ imageUrl: art.imageUrl, textInImage: art.textInImage })}
      />
      <SwitchRow label="Title is part of the image" description="When on, the app adds no text over the artwork" value={state.textInImage} onValueChange={(textInImage) => onChange({ textInImage })} />
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  note: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary, marginTop: 8 },
});
