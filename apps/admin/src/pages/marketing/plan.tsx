import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { Alert, Spin, Tabs } from "antd";
import { useCan } from "@refinedev/core";
import { RocketOutlined } from "@ant-design/icons";
import { axiosInstance } from "../../providers/data-provider";
import { useEntitlements } from "../../hooks/use-entitlements";
import { sectionTitle } from "../../theme";
import { BillingTab } from "./billing-tab";
import { BrandAdsTab } from "./brand-ads-tab";
import { PlanTab } from "./plan-tab";
import { ResultsTab } from "./results-tab";
import type { AdProduct, BillingProfile } from "./types";

function useCatalogue() {
  const [products, setProducts] = useState<AdProduct[]>([]);
  const [profile, setProfile] = useState<BillingProfile | null>(null);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([axiosInstance.get("/marketing/products"), axiosInstance.get("/marketing/billing-profile")])
      .then(([list, billing]) => {
        setProducts(list.data.data);
        setProfile(billing.data.data);
      })
      .catch((err) => {
        if (!isAxiosError(err)) throw err;
        setError(err.response?.data?.message ?? "Could not load plans");
      });
  }, []);
  return { products, profile, setProfile, error };
}

export const MarketingPlan = () => {
  const { entitlements, error: entitlementsError, reload } = useEntitlements();
  const { products, profile, setProfile, error: catalogueError } = useCatalogue();
  const error = entitlementsError ?? catalogueError;
  const { data: buyAccess } = useCan({ resource: "marketing-plan", action: "create" });
  const { data: brandAdsAccess } = useCan({ resource: "brand-ads", action: "edit" });
  // Bumped after each purchase so the invoices list fetches the new invoice
  const [purchases, setPurchases] = useState(0);
  const onPaid = async () => {
    setPurchases((n) => n + 1);
    await reload();
  };

  if (error) return <Alert type="warning" showIcon message={error} />;
  if (!entitlements) return <Spin style={{ display: "block", margin: "64px auto" }} />;

  return (
    <>
      <h2 style={{ marginTop: 0 }}>{sectionTitle(<RocketOutlined />, "Marketing plan")}</h2>
      <Tabs
        items={[
          {
            key: "plan",
            label: "Plan",
            children: <PlanTab entitlements={entitlements} products={products} profile={profile} canBuy={!!buyAccess?.can} onProfileSaved={setProfile} onPaid={onPaid} />,
          },
          { key: "billing", label: "Billing & invoices", children: <BillingTab profile={profile} canEdit={!!buyAccess?.can} onSaved={setProfile} purchases={purchases} /> },
          { key: "results", label: "Results", children: <ResultsTab /> },
          { key: "brand-ads", label: "Brand ads", children: <BrandAdsTab canEdit={!!brandAdsAccess?.can} /> },
        ]}
      />
    </>
  );
};
