import { memo, useCallback } from "react";
import { StyleSheet, View } from "react-native";
import type { ProductRowSection as ProductRow } from "@martly/shared/types";
import { ProductList } from "../../ProductList";
import type { StoreProduct } from "../../../lib/types";
import { openSeeAll, useSectionText } from "./context";
import { SectionHeader } from "./SectionHeader";
import { SeeAllButton } from "./SeeAllButton";

/** A collection as a horizontal rail, with a "See all" pill when the collection holds more than the rail shows */
export const ProductRowSection = memo(function ProductRowSection({ section }: { section: ProductRow<StoreProduct> }) {
  const { title, subtitle } = useSectionText(section);
  const { seeAll } = section;
  const onSeeAll = useCallback(() => { if (seeAll) openSeeAll(seeAll); }, [seeAll]);
  const { style: look, tint } = section.header;
  // A framed header's tint carries on behind the rail, so the opener and its products read as one block
  const band = tint && look !== "PLAIN" ? { backgroundColor: tint } : null;

  return (
    <View style={[styles.section, band && [styles.band, band]]}>
      <SectionHeader title={title} subtitle={subtitle} look={look} imageUrl={section.header.imageUrl} tint={tint} />
      <ProductList products={section.products} layout="rail" elevated={band !== null} contentContainerStyle={band && styles.bandRail} />
      {seeAll && <SeeAllButton onPress={onSeeAll} label={section.total > 0 ? `See all ${section.total} products` : "See all"} />}
    </View>
  );
});

const styles = StyleSheet.create({
  section: { marginTop: 16 },
  band: { paddingTop: 10, paddingBottom: 12 },
  // Room under the raised cards so their shadow isn't clipped by the rail
  bandRail: { paddingBottom: 8 },
});
