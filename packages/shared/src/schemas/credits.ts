import { z } from "zod";

const creditTranslations = z.record(z.string(), z.object({
  headline: z.string().trim().max(60).optional(),
  message: z.string().trim().max(200).optional(),
})).nullish();

const campaignFields = {
  amount: z.number().positive().max(10000),
  minOrderAmount: z.number().min(0),
  validDays: z.number().int().min(1).max(90),
  budget: z.number().positive(),
  headline: z.string().trim().max(60).nullish(),
  message: z.string().trim().max(200).nullish(),
  translations: creditTranslations,
  isActive: z.boolean(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().nullish(),
};

/** No storeId: funded by Martly (super admin only). With a storeId: funded by that store */
export const createCreditCampaignSchema = z.object({
  ...campaignFields,
  isActive: campaignFields.isActive.default(true),
  startsAt: campaignFields.startsAt.optional(),
  storeId: z.string().uuid().nullish(),
}).refine((c) => c.minOrderAmount >= c.amount, {
  message: "Minimum order must be at least the credit amount", path: ["minOrderAmount"],
});
export type CreateCreditCampaignInput = z.infer<typeof createCreditCampaignSchema>;

export const updateCreditCampaignSchema = z.object(campaignFields).partial();
export type UpdateCreditCampaignInput = z.infer<typeof updateCreditCampaignSchema>;

export const creditStoreQuerySchema = z.object({ storeId: z.string().uuid() });

export const listCreditCampaignsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  storeId: z.string().uuid().optional(),
  scope: z.enum(["martly", "store"]).optional(),
});
