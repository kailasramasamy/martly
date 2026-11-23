import * as z from "zod/v4";

const mm = z.number().optional();
export const readingSchema = z.object({
  shape: z.enum(["ROUND", "BOX", "FLAT"]),
  lengthMm: mm, widthMm: mm, heightMm: mm, topDiameterMm: mm, baseDiameterMm: mm,
  baseScale: z.number().optional(), fit: z.number().optional(), tableHeight: z.number(), topViewSlideMm: z.number(),
  warnings: z.array(z.string()), outline: z.array(z.array(z.number())).optional(),
});
export type Reading = z.infer<typeof readingSchema>;

export const batchSchema = z.object({
  version: z.literal(1), batchId: z.string(), storeId: z.string().uuid(), storeName: z.string(), createdAt: z.string(),
  items: z.array(z.object({
    itemId: z.string(), groupId: z.string(), price: z.number().positive(), flat: z.boolean(), capturedAt: z.string(),
    reading: readingSchema, photoCount: z.number().int().positive(),
  })),
});
export type Batch = z.infer<typeof batchSchema>;

export const remeasuredSchema = z.object({
  itemId: z.string(), phone: readingSchema.nullish(), mac: readingSchema.nullish(), error: z.string().nullish(),
});
export type Remeasured = z.infer<typeof remeasuredSchema>;

/** Which size fields each shape carries, matching the app's payload */
export const SIZE_FIELDS = {
  ROUND: ["topDiameterMm", "baseDiameterMm", "heightMm"],
  BOX: ["lengthMm", "widthMm", "heightMm"],
  FLAT: ["lengthMm", "widthMm"],
} as const;

const DIFF_LIMIT_MM = 5;

export function sizeOf(reading: Reading) {
  return Object.fromEntries(SIZE_FIELDS[reading.shape].map((field) => [field, reading[field]]).filter(([, value]) => value));
}

export function sizeText(reading: Reading | null) {
  if (!reading) return "-";
  const parts = SIZE_FIELDS[reading.shape].map((field) => reading[field]).filter((v): v is number => !!v).map((v) => (v / 10).toFixed(1));
  return (reading.shape === "ROUND" ? "Ø" : "") + parts.join("x");
}

export function flagsOf(row: Remeasured) {
  const flags = (row.phone?.warnings ?? []).map((w) => `phone: ${w}`);
  if (row.error) flags.push(`mac error: ${row.error}`);
  if (row.phone && row.mac) {
    if (row.phone.shape !== row.mac.shape) flags.push(`shape ${row.phone.shape} vs ${row.mac.shape}`);
    const fields = ["lengthMm", "widthMm", "heightMm", "topDiameterMm", "baseDiameterMm"] as const;
    for (const field of fields) {
      const [a, b] = [row.phone[field], row.mac[field]];
      if (a !== undefined && b !== undefined && Math.abs(a - b) > DIFF_LIMIT_MM) flags.push(`${field} differs ${Math.abs(a - b)} mm`);
    }
  }
  return flags;
}
