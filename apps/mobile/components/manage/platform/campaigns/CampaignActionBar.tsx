import type { ReactNode } from "react";
import { Button } from "../../ui/Button";
import type { Campaign } from "../types";
import type { CampaignActions } from "./use-campaign-actions";

const flex = { flex: 1 };
const CANCELLABLE = ["DRAFT", "PENDING_PAYMENT", "IN_REVIEW", "SCHEDULED"];

/** Pinned buttons for the campaign's status, or null when nothing can be done */
export function campaignActionBar(campaign: Campaign, a: CampaignActions): ReactNode {
  const { status } = campaign;
  const buttons: ReactNode[] = [];
  if (status === "PENDING_PAYMENT") buttons.push(<Button key="paid" label="Mark paid" onPress={() => a.setDialog("paid")} style={flex} />);
  if (status === "IN_REVIEW") {
    buttons.push(<Button key="approve" label="Approve" onPress={() => a.setDialog("approve")} style={flex} />);
    buttons.push(<Button key="reject" label="Reject" variant="danger" onPress={() => a.setDialog("reject")} style={flex} />);
  }
  if (status === "LIVE") buttons.push(<Button key="end" label="End now" variant="danger" onPress={() => a.setDialog("end")} style={flex} />);
  if (CANCELLABLE.includes(status)) buttons.push(<Button key="cancel" label="Cancel" variant="danger" onPress={() => a.setDialog("cancel")} style={flex} />);
  return buttons.length ? buttons : null;
}
