import { useEffect, useRef, useState } from "react";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import { useResource } from "../../../lib/manage/use-resource";

type Translations = Record<string, { name?: string; tagline?: string; offerText?: string; brandName?: string }>;

interface StoreBranding {
  name: string;
  brandName: string | null;
  logoUrl: string | null;
  imageUrl: string | null;
  promoImages: string[];
  tagline: string | null;
  brandColor: string | null;
  highlights: string[];
  translations: Translations | null;
}

export interface BrandingForm {
  brandName: string;
  brandNameTa: string;
  logoUrl: string | null;
  imageUrl: string | null;
  promoImages: (string | null)[];
  tagline: string;
  taglineTa: string;
  brandColor: string;
  highlights: string[];
}

export const MAX_POSTERS = 3;
export const MAX_HIGHLIGHTS = 4;
const pad = <T,>(list: T[], size: number, fill: T) => [...list, ...Array(Math.max(0, size - list.length)).fill(fill)].slice(0, size);

function toForm(s: StoreBranding): BrandingForm {
  return {
    brandName: s.brandName ?? "", brandNameTa: s.translations?.ta?.brandName ?? "",
    logoUrl: s.logoUrl, imageUrl: s.imageUrl, promoImages: pad<string | null>(s.promoImages, MAX_POSTERS, null),
    tagline: s.tagline ?? "", taglineTa: s.translations?.ta?.tagline ?? "", brandColor: s.brandColor ?? "",
    highlights: pad(s.highlights, MAX_HIGHLIGHTS, ""),
  };
}

function toBody(f: BrandingForm, existing: Translations | null) {
  const ta = { ...existing?.ta, tagline: f.taglineTa.trim() || undefined, brandName: f.brandNameTa.trim() || undefined };
  return {
    brandName: f.brandName.trim() || null,
    logoUrl: f.logoUrl, imageUrl: f.imageUrl, promoImages: f.promoImages.filter((p): p is string => !!p),
    tagline: f.tagline.trim() || null, brandColor: f.brandColor.trim() || null,
    highlights: f.highlights.map((h) => h.trim()).filter(Boolean),
    translations: { ...existing, ta },
  };
}

/** The store's branding as a form, the AI draft of its words, and saving it back */
export function useBranding(storeId: string, draftOnOpen: boolean) {
  const store = useResource<StoreBranding>(`/api/v1/stores/${storeId}`);
  const [form, setForm] = useState<BrandingForm | null>(null);
  const save = useAction();
  const ai = useAction();
  const drafted = useRef(false);
  useEffect(() => { if (store.data && !form) setForm(toForm(store.data)); }, [store.data, form]);
  const patch = (p: Partial<BrandingForm>) => setForm((f) => (f ? { ...f, ...p } : f));

  const draft = async () => {
    const res = await ai.run(() => api.post<{ tagline: { en: string; ta: string }; highlights: string[] }>("/api/v1/storefront/ai/branding", { storeId }), "Draft ready. Edit anything, then save");
    if (res) patch({ tagline: res.data.tagline.en, taglineTa: res.data.tagline.ta, highlights: pad(res.data.highlights, MAX_HIGHLIGHTS, "") });
  };
  useEffect(() => {
    if (!draftOnOpen || !form || drafted.current) return;
    drafted.current = true;
    void draft();
  });

  const submit = () => form && save.run(() => api.put(`/api/v1/stores/${storeId}`, toBody(form, store.data?.translations ?? null)), "Branding saved");
  return { store, form, patch, draft, drafting: ai.running, submit, saving: save.running };
}
