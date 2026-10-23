import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BannerPlacementLabels, type AdProductKind, type BannerPlacement } from "@martly/shared/constants";
import { colors, fonts, radius } from "../../../../constants/theme";
import { StatusPill } from "../../ui/StatusPill";
import { EmptyState } from "../../ui/EmptyState";
import { formatINR, manage, tabular } from "../../ui/tokens";
import { PlacementPreviewSheet, WhereItShowsLink } from "../placements/PlacementPreviewSheet";
import { isBrandProduct } from "./package-specs";
import type { AdProduct } from "./types";

interface PackageCardProps {
  name: string;
  price: string;
  unit: string;
  /** Short facts under the price */
  facts: string[];
  description?: string | null;
  active: boolean;
  onPress: () => void;
  /** Brand packages: opens the "Where it shows" preview */
  onPreview?: () => void;
}

function PackageCard({ name, price, unit, facts, description, active, onPress, onPreview }: PackageCardProps) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel={`Edit ${name}`}>
      <View style={styles.top}>
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
        <StatusPill label={active ? "On sale" : "Off sale"} color={active ? "#047857" : "#64748b"} bg={active ? "#d1fae5" : manage.hairline} dot={active} />
      </View>
      <Text style={[styles.price, tabular]}>{price}<Text style={styles.unit}> {unit}</Text></Text>
      {facts.length > 0 ? <Text style={styles.facts}>{facts.join("  ·  ")}</Text> : null}
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {onPreview ? <WhereItShowsLink onPress={onPreview} /> : null}
      <Ionicons name="chevron-forward" size={18} color={manage.muted} style={styles.chevron} />
    </TouchableOpacity>
  );
}

interface ListProps { products: AdProduct[]; onEdit: (id: string) => void }

function brandUnit(p: AdProduct): string {
  if (p.kind === "BRAND_CPM") return `/ ${(p.viewsPerUnit ?? 1000).toLocaleString("en-IN")} views`;
  return p.durationDays === 7 ? "/ week" : `/ ${p.durationDays} days`;
}

export function BrandPackagesView({ products, onEdit }: ListProps) {
  const brand = products.filter(isBrandProduct);
  const [previewing, setPreviewing] = useState<AdProduct | null>(null);
  if (brand.length === 0) return <EmptyState icon="pricetags-outline" title="No brand packages" />;
  return (
    <>
      {brand.map((p) => (
        <PackageCard
          key={p.id}
          name={p.name}
          price={formatINR(p.price)}
          unit={brandUnit(p)}
          facts={[p.placement ? BannerPlacementLabels[p.placement as BannerPlacement] ?? p.placement : "No banner"]}
          description={p.description}
          active={p.isActive}
          onPress={() => onEdit(p.id)}
          onPreview={() => setPreviewing(p)}
        />
      ))}
      <PlacementPreviewSheet visible={previewing !== null} target={previewing} onClose={() => setPreviewing(null)} />
    </>
  );
}

function planFacts(p: AdProduct): string[] {
  const facts = [`${p.promotionCredits} promotions / month`, `${p.aiImagesPerMonth} AI images / month`];
  if (p.yearlyPrice !== null) facts.unshift(`${formatINR(p.yearlyPrice)} / year`);
  if (p.pushIncluded) facts.push("Push included");
  return facts;
}

interface Section { title: string; kind: AdProductKind; unit: string; facts: (p: AdProduct) => string[] }

const SECTIONS: Section[] = [
  { title: "Store plans", kind: "STORE_PLAN", unit: "/ month", facts: planFacts },
  { title: "Extra promotion", kind: "PROMOTION_TOPUP", unit: "/ purchase", facts: (p) => [`${p.promotionCredits} promotions`] },
  { title: "AI image packs", kind: "AI_IMAGE_PACK", unit: "/ pack", facts: (p) => [`${p.aiImageCredits} images`] },
];

export function StorePricingView({ products, onEdit }: ListProps) {
  return (
    <>
      {SECTIONS.map((s) => {
        const rows = products.filter((p) => p.kind === s.kind);
        if (rows.length === 0) return null;
        return (
          <View key={s.kind} style={styles.section}>
            <Text style={styles.sectionTitle}>{s.title}</Text>
            {rows.map((p) => (
              <PackageCard key={p.id} name={p.name} price={formatINR(p.price)} unit={s.unit} facts={s.facts(p)} description={p.description} active={p.isActive} onPress={() => onEdit(p.id)} />
            ))}
          </View>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 11, color: colors.textSecondary, letterSpacing: 0.9, textTransform: "uppercase", marginTop: 4 },
  card: { backgroundColor: manage.card, borderRadius: radius.lg, borderWidth: 1, borderColor: manage.line, padding: 14, paddingRight: 36, minHeight: 64, gap: 4 },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  name: { flex: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  price: { fontFamily: fonts.extrabold, fontSize: 24, color: colors.text },
  unit: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
  facts: { fontFamily: fonts.semibold, fontSize: 13, color: colors.primary },
  description: { fontFamily: fonts.medium, fontSize: 13, color: manage.muted, lineHeight: 18 },
  chevron: { position: "absolute", right: 12, top: "50%", marginTop: -9 },
});
