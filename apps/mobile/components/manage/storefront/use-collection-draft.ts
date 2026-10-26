import { useState } from "react";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import { useManageScope } from "../../../lib/manage-scope-context";

export type DraftKind = "STANDARD" | "STORE_SPECIAL";

export interface CollectionDraft {
  title: string;
  subtitle: string;
  titleTa: string;
  subtitleTa: string;
  slug: string;
  artDirection: string;
  organizationId: string;
  products: { id: string; name: string; imageUrl: string | null; subcategory: string | null }[];
}

/** The AI curator's draft collection from a short brief, which the owner edits and then saves as a real collection */
export function useCollectionDraft(kind: DraftKind) {
  const { organizationId } = useManageScope();
  const { run, running } = useAction();
  const [draft, setDraft] = useState<CollectionDraft | null>(null);

  const write = async (brief: string) => {
    const res = await run(() => api.post<CollectionDraft>("/api/v1/collections/ai-draft", { brief, kind, organizationId }));
    if (res) setDraft(res.data);
  };

  const save = async (d: CollectionDraft) => {
    const res = await run(() => api.post<{ id: string }>("/api/v1/collections", {
      title: d.title.trim(), subtitle: d.subtitle.trim() || undefined, slug: d.slug, kind, organizationId: d.organizationId,
      artDirection: d.artDirection, productIds: d.products.map((p) => p.id),
      translations: { ta: { title: d.titleTa.trim() || d.title.trim(), subtitle: d.subtitleTa.trim() || undefined } },
    }), "Collection created");
    return res?.data.id ?? null;
  };

  return { draft, setDraft, write, save, running };
}
