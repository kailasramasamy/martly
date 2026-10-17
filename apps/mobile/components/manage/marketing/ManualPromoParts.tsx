import { Text, StyleSheet } from "react-native";
import { SectionCard } from "../ui/SectionCard";
import { SegmentedTabs } from "../ui/SegmentedTabs";
import { TextField } from "../ui/TextField";
import { SwitchRow } from "../ui/SwitchRow";
import { Button } from "../ui/Button";
import { DateField } from "../ui/DateField";
import { toDateKey } from "../ui/dates";
import { colors, fonts } from "../../../constants/theme";
import { BannerDraftFields, type PromoContext } from "./BannerDraftFields";
import { MAX_BANNERS, emptyDraft } from "./banner-draft";
import { isDiscountable, type ManualPromoErrors, type ManualPromoState, type StartMode } from "./manual-promo";
import type { Entitlements } from "./plan-types";

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

function slotsNote(e: Entitlements | null, adding: number): string | undefined {
  if (!e) return undefined;
  const { used, total } = e.bannerSlots;
  const plan = total === null ? `${used} used, unlimited` : `${used} of ${total} used`;
  return `Banner slots: ${plan}. A live banner uses one slot (${adding} here).`;
}

interface BannersProps {
  state: ManualPromoState;
  errors: ManualPromoErrors;
  onChange: Patch;
  entitlements: Entitlements | null;
}

export function BannersSection({ state, errors, onChange, entitlements }: BannersProps) {
  const promo: PromoContext = { title: state.title, subtitle: state.subtitle, actionType: state.actionType, actionTarget: state.actionTarget };
  const update = (key: string, patch: object) => onChange({ banners: state.banners.map((b) => (b.key === key ? { ...b, ...patch } : b)) });
  return (
    <>
      {state.banners.map((b, i) => (
        <SectionCard key={b.key} title={`Banner ${i + 1}`} action={state.banners.length > 1 ? { label: "Remove", onPress: () => onChange({ banners: state.banners.filter((x) => x.key !== b.key) }) } : undefined}>
          <BannerDraftFields draft={b} promo={promo} errors={errors.banners[b.key]} entitlements={entitlements} onChange={(patch) => update(b.key, patch)} />
        </SectionCard>
      ))}
      <Text style={styles.slots}>{slotsNote(entitlements, state.banners.length)}</Text>
      {state.banners.length < MAX_BANNERS ? (
        <Button label="Add another placement" icon="add-outline" variant="secondary" onPress={() => onChange({ banners: [...state.banners, emptyDraft()] })} />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  note: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary, marginTop: 8 },
  slots: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary, paddingHorizontal: 4 },
});
