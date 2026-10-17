import { router } from "expo-router";
import type { Banner } from "./types";

export type BannerTarget = Pick<Banner, "actionType" | "actionTarget">;

/** Whether tapping the banner leads anywhere in the app (external links aren't opened yet) */
export function hasBannerTarget(banner: BannerTarget): boolean {
  return !!banner.actionTarget && ["CATEGORY", "PRODUCT", "COLLECTION", "SEARCH"].includes(banner.actionType);
}

/** Opens what a banner points at, for the store currently selected; "replace" swaps out the current screen */
export function openBannerTarget(banner: BannerTarget, how: "push" | "replace" = "push") {
  const id = banner.actionTarget;
  if (!id) return;
  const go = how === "replace" ? router.replace : router.push;
  switch (banner.actionType) {
    case "CATEGORY":
      go({ pathname: "/category/[id]", params: { id } });
      break;
    case "PRODUCT":
      go({ pathname: "/product/[id]", params: { id } });
      break;
    case "COLLECTION":
      go({ pathname: "/collection/[id]", params: { id } });
      break;
    case "SEARCH":
      go({ pathname: "/search", params: { q: id } });
      break;
  }
}
