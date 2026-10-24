import { memo, useCallback } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import type { StoreSpecialsSection as StoreSpecials } from "@martly/shared/types";
import type { LandingCollection, StoreProduct } from "../../../lib/types";
import { OccasionSpotlight } from "../../search/landing/OccasionSpotlight";

/** The store's own ranges (its bakery, its sweets) as the same spotlight cards the search screen shows */
export const StoreSpecialsSection = memo(function StoreSpecialsSection({ section }: { section: StoreSpecials<StoreProduct> }) {
  const openAisle = useCallback((id: string) => router.push({ pathname: "/category/[id]", params: { id } }), []);
  return (
    <View style={styles.section}>
      {section.collections.map((c) => (
        <OccasionSpotlight key={c.id} collection={c as LandingCollection} onSubcategory={openAisle} />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  section: { marginTop: 8 },
});
