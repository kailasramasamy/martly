import { Keyboard, ScrollView, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { spacing } from "../../../constants/theme";
import { useStrings } from "../../../lib/i18n/use-strings";
import { ProductList } from "../../ProductList";
import { SkeletonBox } from "../../SkeletonLoader";
import { LandingSection } from "./LandingSection";
import { QueryChips } from "./QueryChips";
import { OccasionSpotlight } from "./OccasionSpotlight";
import { CategoryGrid } from "./CategoryGrid";
import type { SearchLanding as LandingData } from "../../../lib/types";

const TIME_ICONS: Record<LandingData["timePicks"]["period"], keyof typeof Ionicons.glyphMap> = {
  morning: "sunny-outline",
  afternoon: "partly-sunny-outline",
  evening: "restaurant-outline",
  night: "moon-outline",
};

interface SearchLandingProps {
  data: LandingData | null;
  loading: boolean;
  recent: string[];
  onSearch: (query: string) => void;
  onRemoveRecent: (query: string) => void;
  onClearRecent: () => void;
  onCategory: (id: string) => void;
}

function LandingSkeleton() {
  return (
    <View style={styles.skeleton}>
      <SkeletonBox width={140} height={16} />
      <View style={styles.skeletonChips}>
        {[88, 64, 104, 72, 96].map((w, i) => <SkeletonBox key={i} width={w} height={36} borderRadius={18} />)}
      </View>
      <SkeletonBox width={180} height={16} style={{ marginTop: spacing.lg }} />
      <View style={styles.skeletonChips}>
        {[1, 2, 3].map((i) => <SkeletonBox key={i} width={110} height={170} borderRadius={12} />)}
      </View>
    </View>
  );
}

// Every section hides when it has nothing, so a brand-new guest still lands on trending + categories
export function SearchLanding({ data, loading, recent, onSearch, onRemoveRecent, onClearRecent, onCategory }: SearchLandingProps) {
  const t = useStrings("search");
  const reorder = data?.reorder;
  const time = data?.timePicks;
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      onScrollBeginDrag={Keyboard.dismiss}
      contentContainerStyle={styles.content}
    >
      {recent.length > 0 && (
        <LandingSection title={t.recentSearches} action={{ label: t.clear, onPress: onClearRecent }}>
          <QueryChips queries={recent} icon="time-outline" onPress={onSearch} onRemove={onRemoveRecent} />
        </LandingSection>
      )}
      {!data && loading && <LandingSkeleton />}
      {data && data.trending.length > 0 && (
        <LandingSection title={t.trendingNearYou} icon="trending-up">
          <QueryChips queries={data.trending} icon="search" onPress={onSearch} />
        </LandingSection>
      )}
      {reorder && reorder.products.length > 0 && (
        <LandingSection
          title={reorder.dueCount > 0 ? t.runningLow : t.buyAgain}
          subtitle={reorder.dueCount > 0 ? t.dueRefill : t.yourUsuals}
          icon="refresh"
        >
          <ProductList products={reorder.products} layout="rail" />
        </LandingSection>
      )}
      {data?.occasions.map((o) => <OccasionSpotlight key={o.id} collection={o} onSubcategory={onCategory} />)}
      {time && time.products.length > 0 && (
        <LandingSection title={t.timeTitles[time.period]} subtitle={t.pickedForTime} icon={TIME_ICONS[time.period]}>
          <ProductList products={time.products} layout="rail" />
        </LandingSection>
      )}
      {data && data.categories.length > 0 && (
        <LandingSection title={t.popularCategories} icon="grid-outline">
          <CategoryGrid categories={data.categories} onPress={onCategory} />
        </LandingSection>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 120 },
  skeleton: { padding: spacing.md, marginTop: spacing.sm },
  skeletonChips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
});
