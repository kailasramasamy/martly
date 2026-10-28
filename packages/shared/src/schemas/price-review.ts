import { z } from "zod";
import { PriceReviewOutcome } from "../constants/index.js";

export const PRICE_REVIEW_STATUSES = ["pending", "reviewed", "notCarried", "all"] as const;
export const PRICE_REVIEW_GROUP_BY = ["brand", "subcategory"] as const;
export const PRICE_REVIEW_SORTS = ["priority", "name"] as const;
const MAX_DECISIONS = 200;

/** Unbranded listings (loose staples) group under this brand id */
export const UNBRANDED = "none";
const brandId = z.union([z.string().uuid(), z.literal(UNBRANDED)]);

const filters = {
  storeId: z.string().uuid(),
  departmentId: z.string().uuid().optional(),
  q: z.string().trim().optional(),
};
const paging = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
};

export const priceReviewSummaryQuerySchema = z.object({ storeId: z.string().uuid() });

export const priceReviewGroupsQuerySchema = z.object({
  ...filters, ...paging,
  by: z.enum(PRICE_REVIEW_GROUP_BY).default("brand"),
  status: z.enum(PRICE_REVIEW_STATUSES).default("pending"),
});
export type PriceReviewGroupsQuery = z.infer<typeof priceReviewGroupsQuerySchema>;

export const priceReviewItemsQuerySchema = z.object({
  ...filters, ...paging,
  status: z.enum(PRICE_REVIEW_STATUSES).default("pending"),
  outcome: z.nativeEnum(PriceReviewOutcome).optional(),
  brandId: brandId.optional(),
  categoryId: z.string().uuid().optional(),
  subcategoryId: z.string().uuid().optional(),
  sort: z.enum(PRICE_REVIEW_SORTS).default("priority"),
});
export type PriceReviewItemsQuery = z.infer<typeof priceReviewItemsQuerySchema>;

/** One listing settled: no change keeps it, a new price or MRP changes it, hide marks it not sold here */
export const priceReviewDecisionSchema = z.object({
  id: z.string().uuid(),
  price: z.number().positive().optional(),
  /** null goes back to the catalog's MRP */
  mrp: z.number().positive().nullish(),
  hide: z.boolean().optional(),
});
export type PriceReviewDecision = z.infer<typeof priceReviewDecisionSchema>;

export const priceReviewDecideSchema = z.object({
  storeId: z.string().uuid(),
  items: z.array(priceReviewDecisionSchema).min(1).max(MAX_DECISIONS),
});
export type PriceReviewDecideInput = z.infer<typeof priceReviewDecideSchema>;

/** A whole brand, aisle or department settles only its pending listings; picked ids settle whatever they are */
export const priceReviewScopeSchema = z.union([
  z.object({ brandId }),
  z.object({ subcategoryId: z.string().uuid() }),
  z.object({ departmentId: z.string().uuid() }),
  z.object({ storeProductIds: z.array(z.string().uuid()).min(1).max(MAX_DECISIONS) }),
]);
export type PriceReviewScope = z.infer<typeof priceReviewScopeSchema>;

export const priceReviewBulkSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("confirm"), storeId: z.string().uuid(), scope: priceReviewScopeSchema }),
  z.object({ action: z.literal("hide"), storeId: z.string().uuid(), scope: priceReviewScopeSchema }),
  z.object({
    action: z.literal("percentOffMrp"), storeId: z.string().uuid(), scope: priceReviewScopeSchema,
    percent: z.number().min(0).max(90),
  }),
]);
export type PriceReviewBulkInput = z.infer<typeof priceReviewBulkSchema>;

/** Undo: picked listings, or every listing one call settled (its batch time); not-sold ones go back on the shelf */
export const priceReviewReopenSchema = z.union([
  z.object({ storeId: z.string().uuid(), storeProductIds: z.array(z.string().uuid()).min(1).max(MAX_DECISIONS) }),
  z.object({ storeId: z.string().uuid(), batch: z.string().datetime() }),
]);
export type PriceReviewReopenInput = z.infer<typeof priceReviewReopenSchema>;
