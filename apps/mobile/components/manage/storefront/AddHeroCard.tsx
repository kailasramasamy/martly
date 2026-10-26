import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  FIXED_HERO_CARD_KINDS, HERO_CARD_GUIDE, HERO_CARD_PALETTES, HeroCardPaletteLabels, type HeroCardPalette,
} from "@martly/shared/constants";
import { colors, fonts } from "../../../constants/theme";
import { Button } from "../ui/Button";
import { manage } from "../ui/tokens";
import { CollectionField } from "../home-layout/CollectionField";
import { useBilingual } from "./storefront";
import type { HeroCardEntry, HeroConfig } from "./use-hero-cards";

const PALETTES = Object.keys(HERO_CARD_PALETTES) as HeroCardPalette[];

export function PaletteSwatches({ value, onChange }: { value: HeroCardPalette; onChange: (p: HeroCardPalette) => void }) {
  return (
    <View style={styles.swatches}>
      {PALETTES.map((p) => (
        <TouchableOpacity key={p} onPress={() => onChange(p)} accessibilityRole="radio" accessibilityState={{ selected: p === value }}
          accessibilityLabel={HeroCardPaletteLabels[p]} style={[styles.swatch, { backgroundColor: HERO_CARD_PALETTES[p].card }, p === value && styles.picked]}>
          {p === value && <Ionicons name="checkmark" size={18} color={HERO_CARD_PALETTES[p].cardInk} />}
        </TouchableOpacity>
      ))}
    </View>
  );
}

// A collection of the owner's, in a colour they choose; the palette not yet on the carousel comes first
function CollectionCardForm({ config, onAdd }: { config: HeroConfig; onAdd: (card: HeroCardEntry) => void }) {
  const used = new Set(config.cards.flatMap((c) => (c.kind === "COLLECTION" ? [c.palette] : [])));
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [palette, setPalette] = useState<HeroCardPalette>(PALETTES.find((p) => !used.has(p)) ?? "MINT");
  const taken = config.cards.some((c) => "collectionId" in c && c.collectionId === collectionId);
  return (
    <View style={styles.form}>
      <CollectionField value={collectionId} onChange={setCollectionId} required hint={taken ? "This collection already has a card" : undefined} />
      <Text style={styles.label}>Card colour</Text>
      <PaletteSwatches value={palette} onChange={setPalette} />
      <Button label="Add card" icon="add" disabled={!collectionId || taken} onPress={() => collectionId && onAdd({ kind: "COLLECTION", collectionId, palette })} />
    </View>
  );
}

/** Cards the carousel can still take: the self-filling ones it left out, and any number of collection cards */
export function AddHeroCard({ config, onAdd }: { config: HeroConfig; onAdd: (card: HeroCardEntry) => void }) {
  const text = useBilingual();
  const [picking, setPicking] = useState(false);
  const missing = FIXED_HERO_CARD_KINDS.filter((k) => !config.cards.some((c) => c.kind === k));
  return (
    <View>
      {missing.map((kind) => (
        <TouchableOpacity key={kind} style={styles.option} onPress={() => onAdd({ kind } as HeroCardEntry)} accessibilityRole="button">
          <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
          <View style={styles.optionBody}>
            <Text style={styles.optionName}>{text(HERO_CARD_GUIDE[kind].name)}</Text>
            <Text style={styles.optionNote}>{text(HERO_CARD_GUIDE[kind].needs)}</Text>
          </View>
        </TouchableOpacity>
      ))}
      {picking ? <CollectionCardForm config={config} onAdd={(card) => { setPicking(false); onAdd(card); }} /> : (
        <TouchableOpacity style={styles.option} onPress={() => setPicking(true)} accessibilityRole="button">
          <Ionicons name="albums-outline" size={22} color={colors.primary} />
          <View style={styles.optionBody}>
            <Text style={styles.optionName}>A collection card</Text>
            <Text style={styles.optionNote}>Pick one of your collections and a colour</Text>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  option: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 56, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: manage.hairline },
  optionBody: { flex: 1 },
  optionName: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  optionNote: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: manage.muted, marginTop: 2 },
  form: { paddingTop: 12, gap: 4 },
  label: { fontFamily: fonts.bold, fontSize: 13, color: colors.text, marginBottom: 6 },
  swatches: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 },
  swatch: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "transparent" },
  picked: { borderColor: colors.text },
});
