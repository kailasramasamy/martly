import { useState } from "react";
import { api, ApiError } from "../../../../lib/api";
import { useAction } from "../../../../lib/manage/use-action";
import type { Campaign } from "../types";
import type { PaymentDetails } from "./MarkPaidSheet";

export type Dialog = "paid" | "approve" | "reject" | "end" | "cancel" | null;

const POLL_MS = 5000;
const POLL_TRIES = 36;

// Waits for the server to finish painting after the phone stopped waiting on the request
async function awaitNewArt(id: string, before: string | null): Promise<Campaign> {
  for (let i = 0; i < POLL_TRIES; i++) {
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    const latest = (await api.get<Campaign>(`/api/v1/brand-campaigns/${id}`)).data;
    if (latest.imageUrl && latest.imageUrl !== before) return latest;
  }
  throw new Error("The banner is taking longer than usual; pull to refresh in a minute");
}

/** Each action posts to the campaign and hands the refreshed campaign back */
export function useCampaignActions(campaign: Campaign, onChange: (campaign: Campaign) => void) {
  const { run, running } = useAction();
  const generation = useAction();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [note, setNote] = useState("");
  const path = (action: string) => `/api/v1/brand-campaigns/${campaign.id}/${action}`;

  const post = async (action: string, body: object | null, success: string) => {
    const updated = await run(async () => (await api.post<Campaign>(path(action), body)).data, success);
    if (!updated) return;
    onChange(updated);
    setDialog(null);
    setNote("");
  };

  return {
    dialog,
    setDialog,
    note,
    setNote,
    running,
    generating: generation.running,
    markPaid: (details: PaymentDetails) => post("mark-paid", details, "Payment recorded"),
    approve: () => post("review", { approve: true }, "Campaign approved"),
    reject: () => post("review", { approve: false, note: note.trim() || undefined }, "Campaign rejected"),
    end: () => post("end", null, "Campaign ended"),
    cancel: () => post("cancel", null, "Campaign cancelled"),
    // The API takes up to two minutes; iOS drops a request that's silent for about one, but the server keeps painting
    generateArt: async () => {
      const updated = await generation.run(async () => {
        try {
          return (await api.post<Campaign>(path("generate-art"), null)).data;
        } catch (err) {
          if (err instanceof ApiError) throw err;
          return awaitNewArt(campaign.id, campaign.imageUrl);
        }
      });
      if (updated) onChange(updated);
    },
  };
}

export type CampaignActions = ReturnType<typeof useCampaignActions>;
