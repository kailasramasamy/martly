import { useState } from "react";
import { can } from "@martly/shared/permissions";
import { useAuth } from "../../../lib/auth-context";
import { ManageStackScreen } from "../../../components/manage/ManageStackScreen";
import { useStoreScope } from "../../../components/manage/StoreScope";
import { EmptyState } from "../../../components/manage/ui/EmptyState";
import { SegmentedTabs } from "../../../components/manage/ui/SegmentedTabs";
import { HealthTab } from "../../../components/manage/storefront/HealthTab";
import { WorkingTab } from "../../../components/manage/storefront/WorkingTab";
import { useStorefrontHealth } from "../../../components/manage/storefront/storefront";

type Tab = "health" | "working";
const TABS = [{ value: "health" as const, label: "Health" }, { value: "working" as const, label: "What's working" }];

/** How rich the store's app looks, check by check, and what shoppers actually use */
export default function StorefrontScreen() {
  const { user } = useAuth();
  const { storeId, picker } = useStoreScope({ routeParam: true, required: true, placeholder: "Pick a store" });
  const [tab, setTab] = useState<Tab>("health");
  const health = useStorefrontHealth(storeId, true);
  if (!can(user, "storefront")) return <EmptyState icon="lock-closed-outline" title="No access" message="Your role can't change the storefront." />;

  const toolbar = <SegmentedTabs options={TABS} value={tab} onChange={setTab} />;
  return (
    <ManageStackScreen
      title="Storefront"
      toolbar={storeId ? toolbar : undefined}
      scrollKey={tab}
      loading={tab === "health" && !!storeId && health.loading}
      error={tab === "health" ? health.error : null}
      onRetry={health.reload}
      onRefresh={tab === "health" ? health.reload : undefined}
    >
      {picker}
      {!storeId ? null : tab === "health" ? health.data && <HealthTab health={health.data} storeId={storeId} /> : <WorkingTab storeId={storeId} />}
    </ManageStackScreen>
  );
}
