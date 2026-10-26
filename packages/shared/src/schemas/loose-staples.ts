import { z } from "zod";

export const looseStaplesQuerySchema = z.object({ storeId: z.string().uuid() });

/** Prices (and opening stock for new listings) for the store's loose staples; new sizes get listed, listed ones repriced */
export const saveLooseStaplesSchema = z.object({
  storeId: z.string().uuid(),
  /** Stock each newly listed size starts with */
  openingStock: z.number().int().min(0).max(10_000),
  items: z.array(z.object({ variantId: z.string().uuid(), price: z.number().positive().max(100_000) })).min(1).max(1000),
});
export type SaveLooseStaplesInput = z.infer<typeof saveLooseStaplesSchema>;
