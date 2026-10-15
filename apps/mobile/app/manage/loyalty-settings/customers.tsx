import { useState } from "react";
import { ManageListScreen } from "../../../components/manage/ManageListScreen";
import { ListRow } from "../../../components/manage/ui/ListRow";
import { LoyaltyCustomerSheet } from "../../../components/manage/marketing/LoyaltyCustomerSheet";
import type { LoyaltyBalance } from "../../../components/manage/marketing/loyalty-types";
import { TONES } from "../../../components/manage/marketing/common";
import { usePagedList } from "../../../lib/manage/use-paged-list";
import { useManageScope } from "../../../lib/manage-scope-context";

export default function LoyaltyCustomersScreen() {
  const { organizationId } = useManageScope();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<LoyaltyBalance | null>(null);
  const list = usePagedList<LoyaltyBalance>("/api/v1/loyalty/customers", { q, organizationId });

  return (
    <>
      <ManageListScreen
        title="Loyalty customers"
        list={list}
        search={{ value: q, onChange: setQ, placeholder: "Search by name or email" }}
        empty={{ icon: "medal-outline", title: "No loyalty balances yet", message: "Customers appear here after they earn their first points." }}
        renderItem={(b) => (
          <ListRow
            title={b.user.name || b.user.email || "Customer"}
            subtitle={b.user.email ?? b.user.phone ?? undefined}
            caption={`Earned ${b.totalEarned} · Redeemed ${b.totalRedeemed}`}
            railColor={TONES.amber.color}
            value={`${b.points} pts`}
            onPress={() => setSelected(b)}
            chevron
          />
        )}
      />
      <LoyaltyCustomerSheet customer={selected} organizationId={organizationId} onClose={() => setSelected(null)} onAdjusted={list.refresh} />
    </>
  );
}
