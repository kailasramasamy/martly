import { useState } from "react";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import { useToast } from "../../../lib/toast-context";
import type { OnboardProduct, OnboardVariant, PickedVariant } from "./types";

const BULK_LIMIT = 200;

interface BulkResult {
  created: number;
  skipped: number;
}

export function pricingError(picked: PickedVariant[]): string | null {
  if (picked.some((p) => !(Number(p.price) > 0))) return "Every selected variant needs a price above 0";
  if (picked.some((p) => p.stock !== "" && !(Number.isInteger(Number(p.stock)) && Number(p.stock) >= 0))) return "Stock must be a whole number";
  return null;
}

export function useOnboard(storeId: string, onDone: () => void) {
  const toast = useToast();
  const { run, running } = useAction();
  const [picked, setPicked] = useState<Record<string, PickedVariant>>({});
  const [defaultStock, setDefaultStock] = useState("0");

  const toggle = (product: OnboardProduct, variant: OnboardVariant) =>
    setPicked((prev) => {
      if (prev[variant.id]) {
        const { [variant.id]: _removed, ...rest } = prev;
        return rest;
      }
      const mrp = variant.mrp == null ? null : Number(variant.mrp);
      return { ...prev, [variant.id]: { variantId: variant.id, productName: product.name, variantName: variant.name, mrp, price: mrp ? String(mrp) : "", stock: defaultStock } };
    });

  const patch = (variantId: string, next: Partial<PickedVariant>) =>
    setPicked((prev) => ({ ...prev, [variantId]: { ...prev[variantId], ...next } }));

  const applyStockToAll = () => setPicked((prev) => Object.fromEntries(Object.entries(prev).map(([id, p]) => [id, { ...p, stock: defaultStock }])));

  const submit = async () => {
    const items = Object.values(picked).map((p) => ({ variantId: p.variantId, price: Number(p.price), stock: Number(p.stock || 0) }));
    const totals = await run(async () => {
      const sum: BulkResult = { created: 0, skipped: 0 };
      for (let i = 0; i < items.length; i += BULK_LIMIT) {
        const res = await api.post<BulkResult>("/api/v1/store-products/bulk", { storeId, items: items.slice(i, i + BULK_LIMIT) });
        sum.created += res.data.created;
        sum.skipped += res.data.skipped;
      }
      return sum;
    });
    if (!totals) return;
    toast.show(`${totals.created} added, ${totals.skipped} already in the store`, "success");
    onDone();
  };

  return { picked, toggle, patch, defaultStock, setDefaultStock, applyStockToAll, submit, running };
}
