import { z } from "zod";
import { INDIAN_STATES } from "../constants/marketing.js";
import { RESERVED_TOWN_SLUGS, URL_SEGMENT_RULE } from "../constants/towns.js";

const urlSegment = z.string().regex(URL_SEGMENT_RULE.pattern, URL_SEGMENT_RULE.message);

/** A store's part of onmartly.in/{town}/{store}; unique within its town */
export const storeSlugSchema = urlSegment;

const townSlugSchema = urlSegment.refine((s) => !(RESERVED_TOWN_SLUGS as readonly string[]).includes(s), "That word is reserved for Martly pages");

export const createTownSchema = z.object({
  name: z.string().trim().min(2).max(60),
  slug: townSlugSchema,
  district: z.string().trim().min(2).max(60),
  state: z.enum(INDIAN_STATES),
});
export type CreateTownInput = z.infer<typeof createTownSchema>;

export const updateTownSchema = createTownSchema.partial();
export type UpdateTownInput = z.infer<typeof updateTownSchema>;

export const townQuerySchema = z.object({
  q: z.string().trim().max(60).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
