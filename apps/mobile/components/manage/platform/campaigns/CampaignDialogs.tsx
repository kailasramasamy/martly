import { ConfirmDialog } from "../../ui/ConfirmDialog";
import { TextField } from "../../ui/TextField";
import type { Campaign } from "../types";
import { MarkPaidSheet } from "./MarkPaidSheet";
import type { CampaignActions } from "./use-campaign-actions";

export function CampaignDialogs({ campaign, a }: { campaign: Campaign; a: CampaignActions }) {
  const close = () => a.setDialog(null);
  const refund = campaign.adOrder?.status === "PAID" ? "The payment is refunded." : "Nothing has been charged.";
  const common = { running: a.running, onClose: close };

  return (
    <>
      <MarkPaidSheet key={campaign.id} visible={a.dialog === "paid"} campaignId={campaign.id} brandName={campaign.brand.name} running={a.running} onSubmit={a.markPaid} onClose={close} />
      <ConfirmDialog {...common} visible={a.dialog === "approve"} title="Approve this campaign?" message="It goes live on its start date." confirmLabel="Approve" confirmVariant="primary" onConfirm={a.approve} />
      <ConfirmDialog {...common} visible={a.dialog === "reject"} title="Reject this campaign" message="Tell the brand why (optional)." confirmLabel="Reject" onConfirm={a.reject}>
        <TextField value={a.note} onChangeText={a.setNote} multiline maxLength={400} placeholder="Reason" />
      </ConfirmDialog>
      <ConfirmDialog {...common} visible={a.dialog === "end"} title="End this campaign now?" message="It stops running immediately." confirmLabel="End now" onConfirm={a.end} />
      <ConfirmDialog {...common} visible={a.dialog === "cancel"} title="Cancel this campaign?" message={refund} confirmLabel="Cancel campaign" cancelLabel="Keep campaign" onConfirm={a.cancel} />
    </>
  );
}
