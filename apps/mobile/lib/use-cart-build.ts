import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import type { CartBuilderEvent } from "@martly/shared/types";
import { api, ApiError } from "./api";
import { activeLanguage } from "./i18n";
import { useToast } from "./toast-context";
import { useStrings } from "./i18n/use-strings";
import type { BuiltLine, ReviewState } from "./cart-builder";
import type { StoreProduct } from "./types";

type Event = CartBuilderEvent<StoreProduct>;

/** Folds one streamed event into the review */
function apply(review: ReviewState | null, e: Event): ReviewState | null {
  if (e.type === "lines") return { runId: null, lines: e.lines.map((l, i) => ({ ...l, key: String(i), said: l.text, line: null })) };
  if (!review) return review;
  if (e.type === "line") return { ...review, lines: review.lines.map((l, i) => (i === e.index ? { ...l, line: e.line } : l)) };
  if (e.type === "done") return { ...review, runId: e.runId, itemIds: e.itemIds };
  // Failed part-way: lines still being matched show as not found rather than loading forever
  return { ...review, lines: review.lines.map((l) => (l.line ? l : { ...l, line: { text: l.text, item: l.item, confidence: "NOT_FOUND", candidates: [] } })) };
}

/** Searches one re-worded line again, leaving every other line (and the cart) as it is */
function useResearch(review: ReviewState | null, setReview: Dispatch<SetStateAction<ReviewState | null>>) {
  const toast = useToast();
  const t = useStrings("shoppingList");
  return useCallback(async (index: number, text: string, storeId: string) => {
    const before = review?.lines[index];
    if (!before) return;
    const key = `${before.key}.${Date.now()}`;
    const pending = { key, text, item: text, said: before.said, line: null };
    setReview((r) => r && { ...r, edited: true, lines: r.lines.map((l, i) => (i === index ? pending : l)) });
    try {
      const { data } = await api.post<BuiltLine[]>("/api/v1/list-to-cart/line", { storeId, text, language: activeLanguage() ?? undefined });
      // Re-worded into two things ("ghee and sugar"): the line becomes two
      const found = data.length > 0
        ? data.map((line, n) => ({ key: `${key}.${n}`, text: line.text, item: line.item, said: before.said, line }))
        : [{ ...pending, line: { text, item: text, confidence: "NOT_FOUND" as const, candidates: [] } }];
      setReview((r) => r && { ...r, lines: r.lines.flatMap((l) => (l.key === key ? found : [l])) });
    } catch (err) {
      if (!(err instanceof ApiError || err instanceof TypeError)) throw err;
      toast.show(err instanceof ApiError ? err.message : t.buildFailed, "error");
      setReview((r) => r && { ...r, lines: r.lines.map((l) => (l.key === key ? before : l)) });
    }
  }, [review, setReview, toast, t]);
}

/**
 * Builds a cart from a list, streaming: `reading` while the list is read (a few seconds), then `review` as soon as
 * its lines are known, with each line's products filling in as they're found.
 */
export function useCartBuild() {
  const toast = useToast();
  const t = useStrings("shoppingList");
  const [phase, setPhase] = useState<"idle" | "reading" | "review">("idle");
  const [review, setReview] = useState<ReviewState | null>(null);

  const build = useCallback(async (path: string, body: object) => {
    setPhase("reading");
    setReview(null);
    try {
      // The app language picks which glossary phrases help read the list
      await api.stream<Event>(path, { ...body, language: activeLanguage() ?? undefined }, (e) => {
        if (e.type === "error") toast.show(e.message, "error");
        if (e.type === "lines" && e.lines.length === 0) {
          toast.show(t.buildFailed, "error");
          return setPhase("idle");
        }
        setReview((r) => apply(r, e));
        if (e.type === "lines") setPhase("review");
      });
    } catch (err) {
      if (!(err instanceof ApiError || err instanceof TypeError)) throw err;
      toast.show(err instanceof ApiError ? err.message : t.buildFailed, "error");
      setPhase((p) => (p === "reading" ? "idle" : p));
      setReview((r) => apply(r, { type: "error", message: "" }));
    }
  }, [toast, t]);

  const research = useResearch(review, setReview);

  const reset = useCallback(() => {
    setPhase("idle");
    setReview(null);
  }, []);

  return { phase, review, build, research, reset };
}
