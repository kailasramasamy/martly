import { useState } from "react";
import { Text, StyleSheet } from "react-native";
import { ManageStackScreen } from "../../ManageStackScreen";
import { SegmentedTabs } from "../../ui/SegmentedTabs";
import { colors, fonts } from "../../../../constants/theme";
import { BrandPackagesView, StorePricingView } from "./ProductCards";
import { InvoicingView, LimitsView } from "./ConfigCards";
import { InvoicingEditSheet, LimitsEditSheet } from "./ConfigSheets";
import { PackageEditSheet } from "./PackageEditSheet";
import { usePricing } from "./use-pricing";
import type { AdProduct, PricingConfig, PricingData } from "./types";

type Tab = "brands" | "stores" | "limits" | "invoicing";
type Sheet = "package" | "limits" | "invoicing";

const TABS = [
  { value: "brands" as const, label: "Brands" },
  { value: "stores" as const, label: "Stores" },
  { value: "limits" as const, label: "Limits" },
  { value: "invoicing" as const, label: "Invoicing" },
];

export function PricingScreen() {
  const pricing = usePricing();
  const [tab, setTab] = useState<Tab>("brands");
  const [sheet, setSheet] = useState<Sheet | null>(null);
  // Kept after the sheet closes so the package doesn't vanish mid-animation
  const [packageId, setPackageId] = useState<string | null>(null);
  // Bumped on each open so a sheet starts from the saved values, not an abandoned draft
  const [opens, setOpens] = useState(0);
  const { data, saving } = pricing;

  const open = (next: Sheet) => { setOpens((n) => n + 1); setSheet(next); };
  const editPackage = (id: string) => { setPackageId(id); open("package"); };
  const commit = async (next: PricingData) => { if (await pricing.save(next)) setSheet(null); };
  const saveProduct = (product: AdProduct) => data && commit({ ...data, products: data.products.map((p) => (p.id === product.id ? product : p)) });
  const saveConfig = (config: PricingConfig) => data && commit({ ...data, config });
  const editing = data?.products.find((p) => p.id === packageId);

  return (
    <ManageStackScreen
      title="Ad pricing"
      loading={pricing.loading && !data}
      error={data ? null : pricing.error}
      onRetry={pricing.reload}
      refreshing={pricing.refreshing}
      onRefresh={pricing.refresh}
      toolbar={<SegmentedTabs options={TABS} value={tab} onChange={setTab} />}
      scrollKey={tab}
    >
      {data ? (
        <>
          {tab === "brands" ? <BrandPackagesView products={data.products} onEdit={editPackage} /> : null}
          {tab === "stores" ? <StorePricingView products={data.products} onEdit={editPackage} /> : null}
          {tab === "limits" ? <LimitsView config={data.config} products={data.products} onEdit={() => open("limits")} /> : null}
          {tab === "invoicing" ? <InvoicingView config={data.config} onEdit={() => open("invoicing")} /> : null}
          <Text style={styles.note}>Price changes apply to new purchases only.</Text>
          {editing ? <PackageEditSheet key={`p${opens}`} visible={sheet === "package"} product={editing} saving={saving} onSave={saveProduct} onClose={() => setSheet(null)} /> : null}
          <LimitsEditSheet key={`l${opens}`} visible={sheet === "limits"} config={data.config} products={data.products} saving={saving} onSave={saveConfig} onClose={() => setSheet(null)} />
          <InvoicingEditSheet key={`i${opens}`} visible={sheet === "invoicing"} config={data.config} saving={saving} onSave={saveConfig} onClose={() => setSheet(null)} />
        </>
      ) : null}
    </ManageStackScreen>
  );
}

const styles = StyleSheet.create({
  note: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
});
