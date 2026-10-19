import { memo, useCallback } from "react";
import { router } from "expo-router";
import type { SystemSection } from "@martly/shared/types";
import type { FestiveHero as FestiveHeroData, FestiveTile } from "../../../../lib/types";
import { FestiveHero } from "../../FestiveHero";
import { useHomeSectionEnv } from "../context";

export const FestiveHeroSection = memo(function FestiveHeroSection({ section }: { section: SystemSection }) {
  const hero = section.data.hero as FestiveHeroData;
  const { backdrop } = useHomeSectionEnv();
  const onTile = useCallback(
    (tile: FestiveTile) => router.push({ pathname: "/festival/[id]", params: { id: hero.id, tile: tile.id } }),
    [hero.id],
  );
  return <FestiveHero hero={hero} onTile={onTile} backdrop={backdrop} />;
});
