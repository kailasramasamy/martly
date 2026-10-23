import { useCallback, useState } from "react";
import { useRouter } from "expo-router";
import { api } from "../../../../lib/api";
import { useAction } from "../../../../lib/manage/use-action";
import type { BrandPackage, Campaign } from "../types";
import { buildBody, initialState, stateFromCampaign, validate, type FormErrors, type FormState } from "./form-state";

/** Form state for booking or editing a campaign; save posts or puts the body, then opens the campaign */
export function useCampaignForm(campaign: Campaign | null, packages: BrandPackage[], startDate?: string) {
  const router = useRouter();
  const { run, running } = useAction();
  const [state, setState] = useState(() => (campaign ? stateFromCampaign(campaign) : initialState(startDate)));
  const [errors, setErrors] = useState<FormErrors>({});
  const product = packages.find((p) => p.id === state.productId);
  const patch = useCallback((p: Partial<FormState>) => setState((prev) => ({ ...prev, ...p })), []);

  const save = async () => {
    const found = validate(state, product);
    setErrors(found);
    if (Object.keys(found).length) return;
    const body = buildBody(state, product);
    const res = await run(() => (campaign
      ? api.put<{ id: string }>(`/api/v1/brand-campaigns/${campaign.id}`, body)
      : api.post<{ id: string }>("/api/v1/brand-campaigns", body)));
    if (res) router.replace(`/manage/brand-campaigns/${res.data.id}`);
  };
  return { state, errors, product, patch, save, saving: running };
}
