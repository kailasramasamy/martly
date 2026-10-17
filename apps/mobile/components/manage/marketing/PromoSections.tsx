import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import type { PromoDetail, PromoProduct } from "@martly/shared/types";
import { SectionCard } from "../ui/SectionCard";
import { ListRow } from "../ui/ListRow";
import { KeyValue } from "../ui/KeyValue";
import { formatDate } from "../ui/dates";
import { manage } from "../ui/tokens";
import { colors, fonts, radius } from "../../../constants/theme";
import { priceRange } from "./promo-utils";

const LANGUAGE: Record<string, string> = { en: "English", ta: "Tamil", art: "Artwork" };
const PRODUCT_PREVIEW = 12;

export function DraftingProgress({ log }: { log: PromoDetail["log"] }) {
  return (
    <SectionCard title="Drafting - usually about a minute">
      {log.map((entry, i) => (
        <KeyValue key={`${entry.at}-${i}`} label={new Date(entry.at).toLocaleTimeString("en-IN")} value={entry.message} />
      ))}
    </SectionCard>
  );
}

export function WordingAndPush({ promo }: { promo: PromoDetail }) {
  return (
    <SectionCard title="Wording and push message">
      {Object.entries(promo.copy ?? {}).map(([lang, c]) => (
        <View key={lang} style={styles.copy}>
          <Text style={styles.lang}>{LANGUAGE[lang] ?? lang}</Text>
          <Text style={styles.copyTitle}>{c.title}</Text>
          <Text style={styles.copySub}>{c.subtitle}</Text>
        </View>
      ))}
      {promo.push ? (
        <View style={styles.copy}>
          <Text style={styles.lang}>Push preview</Text>
          <Text style={styles.copyTitle}>{promo.push.title}</Text>
          <Text style={styles.copySub}>{promo.push.body}</Text>
        </View>
      ) : null}
      {promo.pushSent ? <KeyValue label="Push sent" value={`${promo.pushSent.recipients.toLocaleString("en-IN")} customers, ${formatDate(promo.pushSent.at, true)}`} /> : null}
    </SectionCard>
  );
}

export function Performance({ promo }: { promo: PromoDetail }) {
  const changes = promo.priceChanges;
  if (!changes) return null;
  return (
    <SectionCard title={promo.status === "READY" ? "What launch changes" : "Price changes"}>
      <KeyValue label="Listings" value={changes.listings} />
      <KeyValue label="Stores" value={changes.stores} />
      <KeyValue label="Kept a bigger existing discount" value={changes.keptExisting} />
      {promo.startsAt ? <KeyValue label="Window" value={`${formatDate(promo.startsAt)} → ${promo.endsAt ? formatDate(promo.endsAt) : "open"}`} /> : null}
    </SectionCard>
  );
}

function priceText(p: PromoProduct): string {
  if (p.promoPriceMin == null || p.promoPriceMax == null) return priceRange(p.priceMin, p.priceMax);
  return priceRange(p.promoPriceMin, p.promoPriceMax);
}

interface ProductsProps {
  promo: PromoDetail;
  busy: boolean;
  onRemove: (productId: string) => void;
}

export function PromoProducts({ promo, busy, onRemove }: ProductsProps) {
  const [all, setAll] = useState(false);
  const shown = all ? promo.products : promo.products.slice(0, PRODUCT_PREVIEW);
  const removable = promo.status === "READY" && promo.products.length > 1;
  return (
    <SectionCard title={`Products (${promo.products.length})`} flush>
      {shown.map((p) => (
        <ListRow
          key={p.productId}
          title={p.name}
          subtitle={[p.brand, p.subcategory].filter(Boolean).join(" · ")}
          caption={p.promoPriceMin != null ? `was ${priceRange(p.priceMin, p.priceMax)}` : undefined}
          value={priceText(p)}
          imageUrl={p.imageUrl}
          trailing={removable ? (
            <TouchableOpacity onPress={() => onRemove(p.productId)} disabled={busy} hitSlop={8} style={styles.remove} accessibilityLabel={`Remove ${p.name}`}>
              <Text style={styles.removeText}>Remove</Text>
            </TouchableOpacity>
          ) : undefined}
        />
      ))}
      {!all && promo.products.length > PRODUCT_PREVIEW ? (
        <TouchableOpacity style={styles.more} onPress={() => setAll(true)}>
          <Text style={styles.moreText}>Show all {promo.products.length}</Text>
        </TouchableOpacity>
      ) : null}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  lang: { fontFamily: fonts.bold, fontSize: 11, color: colors.textSecondary, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 6 },
  copy: { marginTop: 8 },
  copyTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  copySub: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.textSecondary, marginTop: 2 },
  remove: { minHeight: 36, justifyContent: "center" },
  removeText: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.error },
  more: { minHeight: 48, alignItems: "center", justifyContent: "center" },
  moreText: { fontFamily: fonts.bold, fontSize: 14, color: colors.primary },
});
