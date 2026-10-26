import { View, Text, Image, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { HeroCardPalette } from "@martly/shared/constants";
import { colors, fonts, radius } from "../../../constants/theme";
import { SectionCard } from "../ui/SectionCard";
import { TextField } from "../ui/TextField";
import { manage, tabular } from "../ui/tokens";
import { PaletteSwatches } from "./AddHeroCard";
import type { CollectionDraft } from "./use-collection-draft";

interface DraftReviewProps {
  draft: CollectionDraft;
  onChange: (draft: CollectionDraft) => void;
  /** Null for a store special, which shows on its own card's colours */
  palette: HeroCardPalette | null;
  onPalette: (p: HeroCardPalette) => void;
}

function Products({ draft, onChange }: Pick<DraftReviewProps, "draft" | "onChange">) {
  const drop = (id: string) => onChange({ ...draft, products: draft.products.filter((p) => p.id !== id) });
  return (
    <SectionCard title={`Products (${draft.products.length})`}>
      {draft.products.map((p) => (
        <View key={p.id} style={styles.product}>
          {p.imageUrl ? <Image source={{ uri: p.imageUrl }} style={styles.photo} /> : <View style={styles.photo} />}
          <View style={styles.productBody}>
            <Text style={styles.productName} numberOfLines={2}>{p.name}</Text>
            {p.subcategory && <Text style={styles.productNote}>{p.subcategory}</Text>}
          </View>
          <TouchableOpacity onPress={() => drop(p.id)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove ${p.name}`} style={styles.remove}>
            <Ionicons name="close" size={20} color={manage.muted} />
          </TouchableOpacity>
        </View>
      ))}
    </SectionCard>
  );
}

/** The AI's draft collection to edit before it's saved: its words in English and Tamil, its products and card colour */
export function DraftReview({ draft, onChange, palette, onPalette }: DraftReviewProps) {
  const set = (field: "title" | "subtitle" | "titleTa" | "subtitleTa") => (value: string) => onChange({ ...draft, [field]: value });
  return (
    <>
      <SectionCard title="Card words">
        <TextField label="Title" required value={draft.title} onChangeText={set("title")} />
        <TextField label="Subtitle" value={draft.subtitle} onChangeText={set("subtitle")} />
        <TextField label="Title in Tamil" value={draft.titleTa} onChangeText={set("titleTa")} />
        <TextField label="Subtitle in Tamil" value={draft.subtitleTa} onChangeText={set("subtitleTa")} />
      </SectionCard>
      {palette && (
        <SectionCard title="Card colour">
          <PaletteSwatches value={palette} onChange={onPalette} />
        </SectionCard>
      )}
      <Products draft={draft} onChange={onChange} />
    </>
  );
}

const styles = StyleSheet.create({
  product: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 56, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: manage.hairline },
  photo: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: manage.hairline },
  productBody: { flex: 1 },
  productName: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 19, color: colors.text },
  productNote: { ...tabular, fontFamily: fonts.medium, fontSize: 12, color: manage.muted, marginTop: 2 },
  remove: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
});
