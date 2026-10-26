import { View, Text, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { STOREFRONT_MIN } from "@martly/shared/constants";
import { colors, fonts } from "../../../constants/theme";
import { ManageStackScreen } from "../../../components/manage/ManageStackScreen";
import { SectionCard } from "../../../components/manage/ui/SectionCard";
import { Button } from "../../../components/manage/ui/Button";
import { manage, tabular } from "../../../components/manage/ui/tokens";
import { AddHeroCard } from "../../../components/manage/storefront/AddHeroCard";
import { HeroCardList, type HeroCardRow } from "../../../components/manage/storefront/HeroCardList";
import { RightNowFields } from "../../../components/manage/storefront/RightNowFields";
import { useHeroCards, type HeroCardEntry, type HeroConfig } from "../../../components/manage/storefront/use-hero-cards";

// Each saved card with how it stands at the store; a card saved since the last health check reads as not ready yet
function rowsOf(config: HeroConfig, readiness: HeroCardRow[]): HeroCardRow[] {
  return config.cards.map((card) => {
    const collectionId = "collectionId" in card ? card.collectionId : undefined;
    return readiness.find((r) => r.kind === card.kind && r.collectionId === collectionId) ?? { kind: card.kind, ready: false, collectionId };
  });
}

function Summary({ rows }: { rows: HeroCardRow[] }) {
  const ready = rows.filter((r) => r.ready).length;
  const goal = STOREFRONT_MIN.HERO_CARDS;
  return (
    <View>
      <Text style={[styles.count, tabular]}>{`${ready} of ${goal}`}<Text style={styles.unit}> cards ready</Text></Text>
      <View style={styles.track}><View style={[styles.fill, { width: `${Math.min(1, ready / goal) * 100}%` }]} /></View>
      <Text style={styles.hint}>Home shows the carousel once 2 cards are ready. Cards that aren't ready stay hidden until they are.</Text>
    </View>
  );
}

/** The big swipeable cards leading Home: which show, what the rest need, and new cards to add */
export default function HeroCardsScreen() {
  const { storeId } = useLocalSearchParams<{ storeId: string }>();
  const router = useRouter();
  const hero = useHeroCards(storeId);
  const { config } = hero;
  const rows = rowsOf(config, hero.readiness);
  const add = (card: HeroCardEntry) => hero.save({ ...config, cards: [...config.cards, card] }, "Card added");
  const remove = (index: number) => hero.save({ ...config, cards: config.cards.filter((_, i) => i !== index) }, "Card removed");

  return (
    <ManageStackScreen title="Hero cards" loading={hero.loading && !hero.readiness.length} error={hero.error} onRetry={hero.reload}
      actions={<Button label="Build a collection card with AI" icon="sparkles" onPress={() => router.push({ pathname: "/manage/storefront/hero-ai", params: { storeId } })} style={styles.action} />}>
      <Summary rows={rows} />
      <SectionCard title="On Home, in this order">
        <HeroCardList rows={rows} storeId={storeId} onRemove={config.cards.length > 1 && !hero.running ? remove : undefined} />
      </SectionCard>
      {config.cards.some((c) => c.kind === "RIGHT_NOW") && (
        <SectionCard title="Right now collections">
          <Text style={styles.hint}>The Right now card switches collection through the day.</Text>
          <RightNowFields config={config} onChange={(rightNow) => hero.save({ ...config, rightNow }, "Saved")} />
        </SectionCard>
      )}
      <SectionCard title="Add a card">
        <AddHeroCard config={config} onAdd={add} />
      </SectionCard>
    </ManageStackScreen>
  );
}

const styles = StyleSheet.create({
  count: { fontFamily: fonts.extrabold, fontSize: 28, color: colors.text },
  unit: { fontFamily: fonts.bold, fontSize: 15, color: colors.textSecondary },
  track: { height: 6, borderRadius: 3, backgroundColor: manage.hairline, overflow: "hidden", marginTop: 8 },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.primary },
  hint: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 19, color: manage.muted, marginTop: 8 },
  action: { flex: 1 },
});
