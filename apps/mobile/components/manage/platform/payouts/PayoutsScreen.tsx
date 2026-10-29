import { useState } from "react";
import { SegmentedTabs } from "../../ui/SegmentedTabs";
import { BalancesTab } from "./BalancesTab";
import { QueueTab } from "./QueueTab";
import { AccountsTab } from "./AccountsTab";
import { AdjustmentsTab } from "./AdjustmentsTab";
import { DuesTab } from "./DuesTab";

type Tab = "balances" | "queue" | "accounts" | "adjustments" | "dues";

const TABS: { value: Tab; label: string }[] = [
  { value: "balances", label: "Balances" },
  { value: "queue", label: "Payout queue" },
  { value: "accounts", label: "Accounts to verify" },
  { value: "adjustments", label: "Adjustments" },
  { value: "dues", label: "Dues" },
];

/** Martly's payouts across organizations; each tab is its own list under the shared tab bar */
export function PayoutsScreen() {
  const [tab, setTab] = useState<Tab>("balances");
  const tabs = <SegmentedTabs options={TABS} value={tab} onChange={setTab} />;
  if (tab === "queue") return <QueueTab tabs={tabs} />;
  if (tab === "accounts") return <AccountsTab tabs={tabs} />;
  if (tab === "adjustments") return <AdjustmentsTab tabs={tabs} />;
  if (tab === "dues") return <DuesTab tabs={tabs} />;
  return <BalancesTab tabs={tabs} />;
}
