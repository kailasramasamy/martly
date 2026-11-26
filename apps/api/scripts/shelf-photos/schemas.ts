import * as z from "zod/v4";

export const Tamil = z.object({
  name: z.string(),
  description: z.string().nullable(),
  ingredients: z.string().nullable(),
  storageInstructions: z.string().nullable(),
  usageInstructions: z.string().nullable(),
  nutrientNames: z.array(z.string()),
});
