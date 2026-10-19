import { memo, useMemo } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import type { SystemSection } from "@martly/shared/types";
import { openBannerTarget } from "../../../../lib/banner-action";
import type { Banner } from "../../../../lib/types";
import { HeroBannerSlide } from "../../../HeroBannerSlide";
import { BannerCarousel } from "../../BannerCarousel";
import { useHomeSectionEnv } from "../context";

const SCREEN_WIDTH = Dimensions.get("window").width;
const H_PADDING = 16;
const open = (banner: Banner) => openBannerTarget(banner);

export const HeroBannersSection = memo(function HeroBannersSection({ section }: { section: SystemSection }) {
  const { festiveHeroId } = useHomeSectionEnv();
  const all = section.data.banners as Banner[];
  // A banner that only points at the live festival repeats the hero above it
  const banners = useMemo(
    () => all.filter((b) => !(festiveHeroId && b.actionType === "COLLECTION" && b.actionTarget === festiveHeroId)),
    [all, festiveHeroId],
  );
  if (banners.length === 0) return null;
  return <BannerCarousel banners={banners} onPress={open} />;
});

export const MidBannersSection = memo(function MidBannersSection({ section }: { section: SystemSection }) {
  const banners = section.data.banners as Banner[];
  return (
    <View style={styles.mid}>
      {banners.map((banner) => (
        <HeroBannerSlide key={banner.id} banner={banner} width={SCREEN_WIDTH - H_PADDING * 2} onPress={open} />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  mid: { paddingHorizontal: H_PADDING, marginTop: 20, gap: 12 },
});
