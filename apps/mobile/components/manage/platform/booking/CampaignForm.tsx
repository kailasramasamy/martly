import { StyleSheet } from "react-native";
import { ManageStackScreen } from "../../ManageStackScreen";
import { Button } from "../../ui/Button";
import { PAID_STATUSES, type Campaign } from "../types";
import { BookingFields } from "./BookingFields";
import { CreativeFields } from "./CreativeFields";
import { Notice } from "./Notice";
import { TargetingFields } from "./TargetingFields";
import { useBookingOptions } from "./use-booking-options";
import { useCampaignForm } from "./use-campaign-form";

const PAID_NOTE = {
  SCHEDULED: "Paid and approved: only the start date and where it runs can change",
  IN_REVIEW: "Paid: the start date, where it runs and the creative can change",
} as const;

/** Book a new brand campaign, or edit one that isn't live yet */
export function CampaignForm({ campaign, startDate }: { campaign: Campaign | null; startDate?: string }) {
  const options = useBookingOptions();
  const { state, errors, product, patch, save, saving } = useCampaignForm(campaign, options.packages, startDate);
  // Paid: the package, length and product are bought; dates and reach can still move, the creative until approval
  const locked = !!campaign && PAID_STATUSES.includes(campaign.status);
  const frozen = campaign?.status === "SCHEDULED";
  const title = campaign ? "Edit campaign" : "Book a campaign";
  const note = campaign && locked ? PAID_NOTE[campaign.status as keyof typeof PAID_NOTE] : null;

  return (
    <ManageStackScreen
      title={title}
      loading={options.loading}
      error={options.error}
      onRetry={options.reload}
      actions={<Button label={campaign ? "Save changes" : "Book campaign"} icon="checkmark" onPress={save} loading={saving} style={styles.btn} />}
    >
      {note ? <Notice message={note} /> : null}
      <BookingFields state={state} errors={errors} onChange={patch} packages={options.packages} categories={options.categories} product={product} campaign={campaign} locked={locked} />
      <TargetingFields state={state} districts={options.districts} stores={options.stores} onChange={patch} />
      <CreativeFields
        product={product} state={state} errors={errors} onChange={patch} locked={locked} frozen={frozen}
        campaign={campaign ? { title: campaign.title, category: campaign.category?.name ?? null } : null}
      />
    </ManageStackScreen>
  );
}

const styles = StyleSheet.create({ btn: { flex: 1 } });
