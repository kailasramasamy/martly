import { z } from "zod";

// ── Store resolution: the store a shopper browses, picked for them rather than asked ──
export const storeResolveQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  /** A town slug, when the shopper picked a town but shared no location */
  town: z.string().trim().max(80).optional(),
  /** The store they already shop at; kept while it is live */
  current: z.string().uuid().optional(),
});
export type StoreResolveQuery = z.infer<typeof storeResolveQuerySchema>;

// ── Cart transfer: the same products, priced at another store ──
export const cartTransferSchema = z.object({
  toStoreId: z.string().uuid(),
  lines: z
    .array(z.object({ productId: z.string().uuid(), variantId: z.string().uuid(), quantity: z.number().int().min(1).max(99) }))
    .min(1)
    .max(100),
});
export type CartTransferInput = z.infer<typeof cartTransferSchema>;
