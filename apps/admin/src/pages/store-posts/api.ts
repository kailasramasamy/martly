import { useEffect, useState } from "react";
import { isAxiosError, type AxiosError } from "axios";
import type { CreateStorePostInput, UpdateStorePostInput } from "@martly/shared/schemas";
import type { PostAudience } from "@martly/shared/store-voice";
import type { VoiceTranslations } from "@martly/shared/types";
import { axiosInstance } from "../../providers/data-provider";

export type PostKind = CreateStorePostInput["kind"];

export const KINDS: { value: PostKind; label: string; color: string }[] = [
  { value: "FRESH_TODAY", label: "Fresh today", color: "green" },
  { value: "NEW_IN_STORE", label: "New in store", color: "blue" },
  { value: "BACK_IN_STOCK", label: "Back in stock", color: "gold" },
];
export const kindOf = (kind: PostKind) => KINDS.find((k) => k.value === kind)!;
// What each kind lasts unless the owner says otherwise: fresh stock is today's news, new arrivals a week
export const KIND_DAYS: Record<PostKind, 0 | 3 | 7> = { FRESH_TODAY: 0, BACK_IN_STOCK: 3, NEW_IN_STORE: 7 };

export interface TaggedProduct { id: string; name: string; imageUrl: string | null }

/** A post in the owner's list: its products as listed today (in stock only) */
export interface StorePostRow {
  id: string;
  kind: PostKind;
  text: string;
  language: string;
  translations: VoiceTranslations | null;
  createdAt: string;
  expiresAt: string;
  products: PostProduct[];
}

/** A tagged product as the store lists it today: its cheapest in-stock size */
export interface PostProduct {
  id: string;
  product: { id: string; name: string; imageUrl: string | null };
  variant: { name: string; imageUrl: string | null };
  pricing: { effectivePrice: number; originalPrice: number };
}

/** A post opened for editing, with every product it tags */
export interface EditablePost {
  id: string;
  storeId: string;
  kind: PostKind;
  text: string;
  expiresAt: string;
  translations: VoiceTranslations | null;
  products: TaggedProduct[];
}

/** The other language of what's written: Tamil script gets English, anything else Tamil */
export const otherOf = (text: string) => (/[\u0B80-\u0BFF]/.test(text) ? "en" : "ta");
export const LANGUAGE_NAMES: Record<string, string> = { ta: "Tamil", en: "English" };

/** What shoppers in the other language would read; null when it can't be made now */
export const translatePreview = (text: string) =>
  axiosInstance.post<{ data: { translations: VoiceTranslations } | null }>("/store-voice/translate", { text }).then((r) => r.data.data);

/** The API's message for a failed call, else a fallback */
export const errorMessage = (err: unknown, fallback: string) =>
  (err as AxiosError<{ message?: string }>)?.response?.data?.message ?? fallback;

export const storeVoice = {
  posts: (storeId: string) => axiosInstance.get<{ data: StorePostRow[] }>(`/store-voice/posts?storeId=${storeId}`).then((r) => r.data.data),
  post: (id: string) => axiosInstance.get<{ data: EditablePost }>(`/store-voice/posts/${id}`).then((r) => r.data.data),
  create: (body: CreateStorePostInput) => axiosInstance.post<{ data: { notified: boolean } }>("/store-voice/posts", body).then((r) => r.data.data),
  update: (id: string, body: UpdateStorePostInput) => axiosInstance.put<{ data: { notified: boolean } }>(`/store-voice/posts/${id}`, body).then((r) => r.data.data),
  remove: (id: string) => axiosInstance.delete(`/store-voice/posts/${id}`),
};

/** Who the push would reach and why, as the kind and tags change */
export function useAudience(storeId: string | undefined, kind: PostKind, productIds: string[]) {
  const [audience, setAudience] = useState<PostAudience | null>(null);
  const key = productIds.join(",");
  useEffect(() => {
    if (!storeId) return;
    let live = true;
    setAudience(null);
    const timer = setTimeout(() => {
      axiosInstance.post<{ data: PostAudience }>("/store-voice/audience", { storeId, kind, productIds: key ? key.split(",") : [] })
        .then((r) => live && setAudience(r.data.data))
        // A failed count leaves "Counting shoppers…"; the post itself is unaffected
        .catch((err: unknown) => { if (!isAxiosError(err)) throw err; });
    }, 400);
    return () => { live = false; clearTimeout(timer); };
  }, [storeId, kind, key]);
  return audience;
}
