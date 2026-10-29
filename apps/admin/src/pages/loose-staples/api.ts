import { useCallback, useEffect, useMemo, useState } from "react";
import { App } from "antd";
import { isAxiosError } from "axios";
import type { ApiResponse, LooseStapleAisle, LooseStapleItem } from "@martly/shared/types";
import { axiosInstance } from "../../providers/data-provider";
import { DEFAULT_OPENING_STOCK, changesOf, withSuggestions, type Drafts } from "./drafts";

const PATH = "/loose-staples";

/** The store's loose staples with draft prices, filled from suggestions or typed, saved in one go */
export function useLooseStaples(storeId: string | undefined) {
  const { message } = App.useApp();
  const [aisles, setAisles] = useState<LooseStapleAisle[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [version, setVersion] = useState(0);
  const [drafts, setDrafts] = useState<Drafts>({});
  const [openingStock, setOpeningStock] = useState(DEFAULT_OPENING_STOCK);

  useEffect(() => {
    setDrafts({});
    if (!storeId) {
      setAisles([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    axiosInstance
      .get<ApiResponse<LooseStapleAisle[]>>(PATH, { params: { storeId } })
      .then(({ data }) => !cancelled && setAisles(data.data))
      .catch((err) => {
        if (!isAxiosError(err)) throw err;
        if (!cancelled) message.error(err.response?.data?.message ?? "Couldn't load the loose staples");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [storeId, version, message]);

  const all = useMemo(() => aisles.flatMap((a) => a.items), [aisles]);
  const changes = useMemo(() => changesOf(all, drafts), [all, drafts]);

  const setPrice = useCallback((variantId: string, text: string) => setDrafts((d) => ({ ...d, [variantId]: text.replace(/[^\d.]/g, "") })), []);
  const fillSuggested = useCallback((items: LooseStapleItem[]) => setDrafts((d) => withSuggestions(items, d)), []);

  const save = async () => {
    if (!storeId || changes.length === 0) return;
    setSaving(true);
    try {
      await axiosInstance.put(PATH, { storeId, openingStock: Number.parseInt(openingStock, 10) || 0, items: changes });
      message.success(`Saved ${changes.length} ${changes.length === 1 ? "price" : "prices"}`);
      setVersion((v) => v + 1);
    } catch (err) {
      if (!isAxiosError(err)) throw err;
      message.error(err.response?.data?.message ?? "Couldn't save the prices");
    } finally {
      setSaving(false);
    }
  };

  return { aisles, all, loading, saving, drafts, setPrice, fillSuggested, changes, openingStock, setOpeningStock, save };
}
