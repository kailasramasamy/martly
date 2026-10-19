import { memo, useRef, useState } from "react";
import { Dimensions, FlatList, StyleSheet, View, type ViewToken } from "react-native";
import type { SystemSection } from "@martly/shared/types";
import { openBannerTarget } from "../../../../lib/banner-action";
import type { Banner } from "../../../../lib/types";
import { HeroBannerSlide } from "../../../HeroBannerSlide";

const H_PADDING = 16;
const POSTER_WIDTH = Math.round(Dimensions.get("window").width * 0.6);
const POSTER_HEIGHT = Math.round(POSTER_WIDTH * 1.5);
const open = (banner: Banner) => openBannerTarget(banner);

function Gap() {
  return <View style={styles.gap} />;
}

export const BrandPostersSection = memo(function BrandPostersSection({ section }: { section: SystemSection }) {
  const banners = section.data.banners as Banner[];
  const [seen, setSeen] = useState<ReadonlySet<string>>(new Set());
  // Only posters that have scrolled into view count as shown
  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    setSeen((prev) => new Set([...prev, ...viewableItems.map((v) => (v.item as Banner).id)]));
  }).current;

  if (banners.length === 0) return null;
  return (
    <FlatList
      horizontal
      style={styles.section}
      data={banners}
      keyExtractor={(banner) => banner.id}
      extraData={seen}
      renderItem={({ item }) => (
        <HeroBannerSlide banner={item} width={POSTER_WIDTH} height={POSTER_HEIGHT} onPress={open} visible={seen.has(item.id)} />
      )}
      ItemSeparatorComponent={Gap}
      onViewableItemsChanged={onViewable}
      viewabilityConfig={VIEWABILITY}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.rail}
    />
  );
});

const VIEWABILITY = { itemVisiblePercentThreshold: 60 };

const styles = StyleSheet.create({
  section: { marginTop: 24, flexGrow: 0 },
  rail: { paddingHorizontal: H_PADDING },
  gap: { width: 12 },
});
