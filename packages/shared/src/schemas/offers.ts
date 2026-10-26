import { z } from "zod";
import { DiscountType } from "../constants/index.js";

export const STORE_OFFER_KINDS = ["BUY_GET", "DISCOUNT", "MEMBER_PRICE"] as const;
export const STORE_OFFER_STATUSES = ["live", "scheduled", "ended"] as const;
const MAX_OFFER_LISTINGS = 200;

const listings = {
  storeId: z.string().uuid(),
  storeProductIds: z.array(z.string().uuid()).min(1, "Pick at least one product").max(MAX_OFFER_LISTINGS),
};
const window = {
  startsAt: z.coerce.date().nullish(),
  endsAt: z.coerce.date().nullish(),
};
const ORDER_MESSAGE = { message: "The offer must end after it starts", path: ["endsAt"] };

/** One offer put on many of a store's listings at once */
export const applyStoreOfferSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("BUY_GET"), ...listings, ...window,
    buy: z.number().int().min(1).max(10),
    get: z.number().int().min(1).max(10),
  }),
  z.object({
    kind: z.literal("DISCOUNT"), ...listings, ...window,
    discountType: z.nativeEnum(DiscountType),
    discountValue: z.number().positive(),
  }),
  // Each listing's member price is its selling price less this %, rounded down to the rupee
  z.object({ kind: z.literal("MEMBER_PRICE"), ...listings, percentOff: z.number().int().min(1).max(90) }),
]).refine((v) => v.kind === "MEMBER_PRICE" || !v.startsAt || !v.endsAt || v.endsAt > v.startsAt, ORDER_MESSAGE)
  .refine((v) => v.kind !== "DISCOUNT" || v.discountType !== "PERCENTAGE" || v.discountValue <= 100, {
    message: "Percentage can't exceed 100", path: ["discountValue"],
  });
export type ApplyStoreOfferInput = z.infer<typeof applyStoreOfferSchema>;

export const endStoreOfferSchema = z.object({ kind: z.enum(STORE_OFFER_KINDS), ...listings });
export type EndStoreOfferInput = z.infer<typeof endStoreOfferSchema>;

export const storeOffersQuerySchema = z.object({
  storeId: z.string().uuid(),
  status: z.enum(STORE_OFFER_STATUSES).default("live"),
  q: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
