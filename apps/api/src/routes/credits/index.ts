import type { FastifyInstance } from "fastify";
import { creditCampaignRoutes } from "./campaigns.js";
import { creditCustomerRoutes } from "./customer.js";

export async function creditRoutes(app: FastifyInstance) {
  await app.register(creditCustomerRoutes);
  await app.register(creditCampaignRoutes);
}
