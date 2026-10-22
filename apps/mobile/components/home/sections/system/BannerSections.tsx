import { memo, useMemo } from "react";
import type { SystemSection } from "@martly/shared/types";
import { openBannerTarget } from "../../../../lib/banner-action";
import type { Banner } from "../../../../lib/types";
import { BannerCarousel } from "../../BannerCarousel";
import { useHomeSectionEnv } from "../context";

const open = (banner: Banner) => openBannerTarget(banner);

export const HeroBannersSection = memo(function HeroBannersSection({ section }: { section: SystemSection }) {
  const { festiveHeroIds } = useHomeSectionEnv();
  const all = section.data.banners as Banner[];
  // A banner that only points at a live festival repeats the hero above it
  const banners = useMemo(
    () => all.filter((b) => !(b.actionType === "COLLECTION" && b.actionTarget && festiveHeroIds.includes(b.actionTarget))),
    [all, festiveHeroIds],
  );
  if (banners.length === 0) return null;
  return <BannerCarousel banners={banners} onPress={open} />;
});
