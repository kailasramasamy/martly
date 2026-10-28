import { z } from "zod";
import { UnitType } from "../constants/index.js";
import { UNBRANDED } from "./price-review.js";

const MAX_ROWS = 200;
const brandId = z.union([z.string().uuid(), z.literal(UNBRANDED)]);
/** Which listings of a group: still to confirm, already carried, or ruled out */
export const CARRY_STATES = ["unchecked", "carried", "notCarried"] as const;
export type CarryState = (typeof CARRY_STATES)[number];

export const stockCheckSummaryQuerySchema = z.object({ storeId: z.string().uuid() });

export const stockCheckBrandsQuerySchema = z.object({
  storeId: z.string().uuid(),
  departmentId: z.string().uuid(),
  status: z.enum([...CARRY_STATES, "all"]).default("unchecked"),
  q: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
});
export type StockCheckBrandsQuery = z.infer<typeof stockCheckBrandsQuerySchema>;

/** `status` keeps the products with a size in that state, opened from that brand tab */
export const stockCheckProductsQuerySchema = z.object({
  storeId: z.string().uuid(),
  departmentId: z.string().uuid(),
  brandId,
  status: z.enum([...CARRY_STATES, "all"]).default("all"),
});
export type StockCheckProductsQuery = z.infer<typeof stockCheckProductsQuerySchema>;

/** A department or brand settles only its listings in state `only` (unconfirmed unless said); picked ids settle as picked */
export const stockCheckScopeSchema = z.union([
  z.object({ departmentId: z.string().uuid(), brandId: brandId.optional(), only: z.enum(CARRY_STATES).default("unchecked") }),
  z.object({ storeProductIds: z.array(z.string().uuid()).min(1).max(MAX_ROWS) }),
]);
export type StockCheckScope = z.input<typeof stockCheckScopeSchema>;

export const stockCheckDecideSchema = z.object({
  storeId: z.string().uuid(),
  scope: stockCheckScopeSchema,
  carried: z.boolean(),
});
export type StockCheckDecideInput = z.infer<typeof stockCheckDecideSchema>;

/** Every size on the sizes screen, on or off */
export const stockCheckSizesSchema = z.object({
  storeId: z.string().uuid(),
  items: z.array(z.object({ id: z.string().uuid(), carried: z.boolean() })).min(1).max(MAX_ROWS),
});
export type StockCheckSizesInput = z.infer<typeof stockCheckSizesSchema>;

export const stockCheckUndoSchema = z.object({ storeId: z.string().uuid(), batch: z.string().datetime() });
export type StockCheckUndoInput = z.infer<typeof stockCheckUndoSchema>;

const price = z.number().positive().max(1_000_000);

/** One product on the sizes screen: fix its prices and add the sizes the store sells that the catalog lacks */
export const stockCheckEditSchema = z.object({
  storeId: z.string().uuid(),
  productId: z.string().uuid(),
  sizes: z.array(z.object({ id: z.string().uuid(), price })).max(50).default([]),
  newSizes: z.array(z.object({ unitType: z.nativeEnum(UnitType), unitValue: z.number().positive().max(10_000), price })).max(10).default([]),
}).refine((v) => v.sizes.length + v.newSizes.length > 0, { message: "Nothing to save" });
export type StockCheckEditInput = z.infer<typeof stockCheckEditSchema>;
