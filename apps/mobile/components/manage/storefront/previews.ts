import type { ImageSourcePropType } from "react-native";
import type { StorefrontCheckKey } from "@martly/shared/constants";

/** What each feature looks like to shoppers: a slice of a real store's app with the feature outlined */
export const CHECK_PREVIEWS: Partial<Record<StorefrontCheckKey, ImageSourcePropType>> = {
  LOGO: require("../../../assets/storefront/logo.webp"),
  COVER: require("../../../assets/storefront/cover.webp"),
  TAGLINE: require("../../../assets/storefront/tagline.webp"),
  HIGHLIGHTS: require("../../../assets/storefront/highlights.webp"),
  // Posters swipe in after the cover photo, in the same spot
  POSTERS: require("../../../assets/storefront/cover.webp"),
  HERO_CARDS: require("../../../assets/storefront/hero-cards.webp"),
  BANNERS: require("../../../assets/storefront/banners.webp"),
  STORE_SPECIALS: require("../../../assets/storefront/store-specials.webp"),
  FESTIVAL: require("../../../assets/storefront/festival.webp"),
  BUY_GET: require("../../../assets/storefront/buy-get.webp"),
  DISCOUNTS: require("../../../assets/storefront/discounts.webp"),
  COUPON: require("../../../assets/storefront/coupon.webp"),
  PROMO: require("../../../assets/storefront/promo.webp"),
  POST: require("../../../assets/storefront/post.webp"),
  MEMBERSHIP: require("../../../assets/storefront/membership.webp"),
  MEMBER_PRICE: require("../../../assets/storefront/member-price.webp"),
  PICKS: require("../../../assets/storefront/picks.webp"),
  REVIEWS: require("../../../assets/storefront/reviews.webp"),
  DELIVERY: require("../../../assets/storefront/delivery.webp"),
  FREE_DELIVERY: require("../../../assets/storefront/free-delivery.webp"),
};
