import { z } from "zod";
import { HomeSectionType } from "../constants/home.js";

const sectionType = z.nativeEnum(HomeSectionType);

/** The Home section a cart line came from, kept on the order item */
export const sectionSourceSchema = z.object({
  sectionId: z.string().min(1).max(64),
  sectionType,
});

// ── Home section analytics ───────────────────────────
export const homeSectionEventsSchema = z.object({
  storeId: z.string().uuid(),
  events: z.array(sectionSourceSchema.extend({
    type: z.enum(["VIEW", "TAP", "ADD"]),
    count: z.coerce.number().int().min(1).max(20),
  })).min(1).max(100),
});
export type HomeSectionEvent = z.infer<typeof homeSectionEventsSchema>["events"][number];

// ── Storefront health ────────────────────────────────
export const storefrontHealthQuerySchema = z.object({
  storeId: z.string().uuid(),
  /** Skip the minute-long cache, e.g. right after the owner turned something on */
  fresh: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
});

export const storefrontEffectivenessQuerySchema = z.object({
  storeId: z.string().uuid(),
  days: z.coerce.number().int().refine((d) => d === 7 || d === 30, "7 or 30 days").default(7),
});
