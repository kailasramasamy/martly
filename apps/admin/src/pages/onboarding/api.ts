import type {
  ApplyCatalogInput, CatalogProposalInput, CatalogRules, CopyStorefrontInput, CreateOnboardingInput, OnboardingStaffInput,
  UpdateOnboardingInput,
} from "@martly/shared/schemas";
import type {
  ApplyCatalogResult, CatalogProposal, OnboardingSummary, OnboardingTeamMember, ReadinessCheck, StorefrontCopyResult, Town, UnpricedItem,
} from "@martly/shared/types";
import { axiosInstance } from "../../providers/data-provider";

/** Store columns the details forms reopen with, plus express hours and the catalog rules last applied */
export interface OnboardingDetails {
  name: string;
  address: string;
  townId: string | null;
  town: Town | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  deliveryRadius: number;
  minOrderAmount: string | null;
  freeDeliveryThreshold: string | null;
  startingDeliveryFee: number | null;
  logoUrl: string | null;
  expressEtaMinutes: number | null;
  opensAt: string | null;
  closesAt: string | null;
  catalogRules: (ApplyCatalogInput & CatalogRules) | null;
}

export type Onboarding = OnboardingSummary & { details: OnboardingDetails };

const data = <T>(p: Promise<{ data: { data: T } }>) => p.then((r) => r.data.data);

export const onboardingApi = {
  list: () => data<OnboardingSummary[]>(axiosInstance.get("/onboarding")),
  templates: () => data<{ id: string; name: string }[]>(axiosInstance.get("/onboarding/templates")),
  get: (storeId: string) => data<Onboarding>(axiosInstance.get(`/onboarding/${storeId}`)),
  create: (input: CreateOnboardingInput) => data<Onboarding>(axiosInstance.post("/onboarding", input)),
  update: (storeId: string, input: UpdateOnboardingInput) => data<Onboarding>(axiosInstance.patch(`/onboarding/${storeId}`, input)),
  team: (storeId: string) => data<OnboardingTeamMember[]>(axiosInstance.get(`/onboarding/${storeId}/team`)),
  addTeamMember: (storeId: string, input: OnboardingStaffInput) =>
    data<OnboardingTeamMember[]>(axiosInstance.post(`/onboarding/${storeId}/team`, input)),
  removeTeamMember: (storeId: string, userId: string) =>
    data<OnboardingTeamMember[]>(axiosInstance.delete(`/onboarding/${storeId}/team/${userId}`)),
  proposal: (storeId: string, input: CatalogProposalInput) =>
    data<CatalogProposal>(axiosInstance.post(`/onboarding/${storeId}/catalog/proposal`, input)),
  unpriced: (storeId: string, rules: CatalogRules) => data<UnpricedItem[]>(axiosInstance.post(`/onboarding/${storeId}/catalog/unpriced`, rules)),
  apply: (storeId: string, input: ApplyCatalogInput) => data<ApplyCatalogResult>(axiosInstance.post(`/onboarding/${storeId}/catalog/apply`, input)),
  listPriced: (storeId: string, items: { variantId: string; price: number; stock: number }[]) =>
    data<{ created: number; skipped: number }>(axiosInstance.post("/store-products/bulk", { storeId, items })),
  storefront: (storeId: string, input: CopyStorefrontInput) =>
    data<StorefrontCopyResult>(axiosInstance.post(`/onboarding/${storeId}/storefront`, input)),
  readiness: (storeId: string) => data<ReadinessCheck[]>(axiosInstance.get(`/onboarding/${storeId}/readiness`)),
  launch: (storeId: string) => data<Onboarding>(axiosInstance.post(`/onboarding/${storeId}/launch`)),
  searchPlaces: (input: string) =>
    data<{ place_id: string; description: string }[]>(axiosInstance.get("/places/autocomplete", { params: { input } })),
  placeDetails: (placeId: string) =>
    data<{ address: string; latitude: number; longitude: number }>(axiosInstance.get("/places/details", { params: { place_id: placeId } })),
};

/** The API's message for a failed request */
export function errorMessage(err: unknown, fallback: string) {
  return (err as { response?: { data?: { message?: string } } }).response?.data?.message ?? fallback;
}

export const STEPS = ["Business & team", "Store", "Region & size", "Catalog", "Storefront", "Review & launch"] as const;
