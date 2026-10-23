import { useState } from "react";
import { View, Image, Text, StyleSheet } from "react-native";
import { SectionCard } from "../../ui/SectionCard";
import { colors, fonts, radius } from "../../../../constants/theme";
import { manage } from "../../ui/tokens";
import { SearchPicker } from "./SearchPicker";

export interface SponsorableProduct {
  id: string;
  name: string;
  imageUrl: string | null;
  subcategory: { name: string; category: { id: string; name: string } } | null;
}

interface Props {
  brandId: string | null;
  value: string | null;
  /** The campaign's saved product name and category, shown until another is picked */
  initial?: { name: string; category: string | null };
  onPick: (product: SponsorableProduct) => void;
  disabled?: boolean;
  error?: string;
}

/** A sponsored product is one of the brand's own products; its photo and category are the creative */
export function SponsoredProductField({ brandId, value, initial, onPick, disabled, error }: Props) {
  const [chosen, setChosen] = useState<SponsorableProduct | null>(null);
  const pick = (p: SponsorableProduct) => { setChosen(p); onPick(p); };
  const shownIn = chosen ? chosen.subcategory?.category.name ?? "No category" : initial?.category;
  return (
    <SectionCard title="Product to sponsor">
      <SearchPicker<SponsorableProduct>
        label="Product"
        required
        path="/api/v1/products"
        params={{ brandId }}
        value={value}
        initialLabel={initial?.name}
        onPick={pick}
        placeholder={brandId ? "Search the brand's products" : "Choose a brand first"}
        disabled={disabled || !brandId}
        error={error}
        hint="Placed second in Home rows and category listings, marked Ad. It can't change after payment."
      />
      {chosen ? (
        <View style={styles.chosen}>
          {chosen.imageUrl ? <Image source={{ uri: chosen.imageUrl }} style={styles.photo} /> : <View style={styles.photo} />}
          <View style={styles.meta}>
            <Text style={styles.name} numberOfLines={2}>{chosen.name}</Text>
            <Text style={styles.cat}>Shows in: {shownIn}</Text>
          </View>
        </View>
      ) : shownIn ? <Text style={styles.cat}>Shows in: {shownIn}</Text> : null}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  chosen: { flexDirection: "row", gap: 12, alignItems: "center" },
  photo: { width: 72, height: 72, borderRadius: radius.md, backgroundColor: manage.canvas },
  meta: { flex: 1, gap: 2 },
  name: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  cat: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
});
