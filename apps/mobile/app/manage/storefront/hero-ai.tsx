import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { HERO_COLLECTION_MIN, type HeroCardPalette } from "@martly/shared/constants";
import { colors, fonts } from "../../../constants/theme";
import { ManageStackScreen } from "../../../components/manage/ManageStackScreen";
import { SectionCard } from "../../../components/manage/ui/SectionCard";
import { TextField } from "../../../components/manage/ui/TextField";
import { Button } from "../../../components/manage/ui/Button";
import { manage } from "../../../components/manage/ui/tokens";
import { DraftReview } from "../../../components/manage/storefront/DraftReview";
import { useCollectionDraft, type DraftKind } from "../../../components/manage/storefront/use-collection-draft";
import { useHeroCards, type HeroConfig } from "../../../components/manage/storefront/use-hero-cards";

const IDEAS: Record<DraftKind, string[]> = {
  STANDARD: ["Breakfast in 10 minutes", "Rainy day snacks", "Pooja essentials", "Healthy tiffin box"],
  STORE_SPECIAL: ["Masala powders we grind here", "Snacks made fresh at our shop", "Our own pickles and podi"],
};

function Brief({ kind, brief, onBrief }: { kind: DraftKind; brief: string; onBrief: (b: string) => void }) {
  return (
    <SectionCard title={kind === "STORE_SPECIAL" ? "What do you make at your shop?" : "What should the card be about?"}>
      <TextField value={brief} onChangeText={onBrief} multiline placeholder="A few words is enough"
        hint="We pick the products from what your store sells and writes the card in English and Tamil. You check it before it's saved." />
      <View style={styles.ideas}>
        {IDEAS[kind].map((idea) => (
          <TouchableOpacity key={idea} style={styles.idea} onPress={() => onBrief(idea)} accessibilityRole="button">
            <Text style={styles.ideaText}>{idea}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SectionCard>
  );
}

// A store special shows on the carousel's store special card; any other collection gets its own card
function withCard(config: HeroConfig, kind: DraftKind, collectionId: string, palette: HeroCardPalette): HeroConfig | null {
  if (kind === "STANDARD") return { ...config, cards: [...config.cards, { kind: "COLLECTION", collectionId, palette }] };
  return config.cards.some((c) => c.kind === "STORE_SPECIAL") ? null : { ...config, cards: [...config.cards, { kind: "STORE_SPECIAL" }] };
}

/** Brief → AI draft → the owner's edits → a saved collection with its card on the Home carousel */
export default function HeroAiScreen() {
  const { storeId, kind = "STANDARD" } = useLocalSearchParams<{ storeId: string; kind?: DraftKind }>();
  const router = useRouter();
  const [brief, setBrief] = useState("");
  const [palette, setPalette] = useState<HeroCardPalette>("ROSE");
  const ai = useCollectionDraft(kind);
  const hero = useHeroCards(storeId);
  const busy = ai.running || hero.running;

  const finish = async () => {
    if (!ai.draft) return;
    const id = await ai.save(ai.draft);
    if (!id) return;
    const next = withCard(hero.config, kind, id, palette);
    if (next) await hero.save(next, "Added to Home");
    router.back();
  };

  const actions = ai.draft ? (
    <>
      <Button label="Start over" variant="secondary" onPress={() => ai.setDraft(null)} disabled={busy} style={styles.back} />
      <Button label="Save and add to Home" icon="checkmark" onPress={finish} loading={busy}
        disabled={!ai.draft.title.trim() || ai.draft.products.length < HERO_COLLECTION_MIN} style={styles.save} />
    </>
  ) : <Button label="Write the card" icon="create-outline" onPress={() => ai.write(brief.trim())} loading={ai.running} disabled={brief.trim().length < 3} style={styles.back} />;

  return (
    <ManageStackScreen title={kind === "STORE_SPECIAL" ? "Store specials" : "Collection card"} actions={actions}>
      {ai.draft
        ? <DraftReview draft={ai.draft} onChange={ai.setDraft} palette={kind === "STANDARD" ? palette : null} onPalette={setPalette} />
        : <Brief kind={kind} brief={brief} onBrief={setBrief} />}
      {ai.draft && ai.draft.products.length < HERO_COLLECTION_MIN && <Text style={styles.warn}>{`Keep at least ${HERO_COLLECTION_MIN} products so the card can show.`}</Text>}
    </ManageStackScreen>
  );
}

const styles = StyleSheet.create({
  ideas: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  idea: { minHeight: 36, justifyContent: "center", paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: manage.line, backgroundColor: manage.card },
  ideaText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  warn: { fontFamily: fonts.semibold, fontSize: 13, color: "#b45309" },
  back: { flex: 1 },
  save: { flex: 1.6 },
});
