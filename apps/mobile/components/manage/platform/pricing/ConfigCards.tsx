import { View, StyleSheet } from "react-native";
import { BannerPlacementLabels } from "@martly/shared/constants";
import { SectionCard } from "../../ui/SectionCard";
import { KeyValue } from "../../ui/KeyValue";
import { Button } from "../../ui/Button";
import { isBrandProduct } from "./package-specs";
import type { AdProduct, PricingConfig } from "./types";

/** Placements a brand package runs in; a placement nothing sells has no limit row */
export function soldPlacements(products: AdProduct[]): string[] {
  const sold = new Set(products.filter(isBrandProduct).map((p) => p.placement));
  return Object.keys(BannerPlacementLabels).filter((placement) => sold.has(placement));
}

const capText = (cap: number | null | undefined) => (typeof cap === "number" ? `${cap} at once` : "No limit");

interface LimitsProps { config: PricingConfig; products: AdProduct[]; onEdit: () => void }

export function LimitsView({ config, products, onEdit }: LimitsProps) {
  return (
    <View style={styles.stack}>
      <SectionCard title="Brand campaigns per placement">
        {soldPlacements(products).map((placement) => (
          <KeyValue key={placement} label={BannerPlacementLabels[placement as keyof typeof BannerPlacementLabels]} value={capText(config.slotLimits[placement]?.BRAND)} />
        ))}
        <KeyValue label="Featured brands per category" value={`${config.featuredBrandSlots} at once`} />
      </SectionCard>
      <Button label="Edit limits" icon="create-outline" variant="secondary" onPress={onEdit} />
    </View>
  );
}

export function InvoicingView({ config, onEdit }: { config: PricingConfig; onEdit: () => void }) {
  return (
    <View style={styles.stack}>
      <SectionCard title="Tax">
        <KeyValue label="GST" value={`${config.gstPercent}%`} />
        <KeyValue label="Free AI redrafts per promotion" value={config.freeRegenerations} />
      </SectionCard>
      <SectionCard title="Seller on invoices">
        <KeyValue label="Invoice prefix" value={config.invoicePrefix} />
        <KeyValue label="Seller name" value={config.sellerName} />
        <KeyValue label="GSTIN" value={config.sellerGstin} />
        <KeyValue label="State" value={config.sellerState} />
        <KeyValue label="Address" value={config.sellerAddress} />
      </SectionCard>
      <Button label="Edit invoicing" icon="create-outline" variant="secondary" onPress={onEdit} />
    </View>
  );
}

const styles = StyleSheet.create({ stack: { gap: 12 } });
