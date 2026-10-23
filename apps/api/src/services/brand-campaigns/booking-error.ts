/** A booking rule the caller broke; the route turns it into this status with the message */
export class CampaignError extends Error {
  name = "CampaignError";
  constructor(message: string, public statusCode = 400) {
    super(message);
  }
}
