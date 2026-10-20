import { useEffect, useMemo, useState } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import { api } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";
import { useAction } from "../../../lib/manage/use-action";
import { useManageScope } from "../../../lib/manage-scope-context";
import { useTaxonomy } from "../taxonomy/use-taxonomy";
import { selectionForSubcategory } from "../taxonomy/selection";
import { emptyProductForm, productToForm, type ProductFormValues } from "./form";
import { validateProductForm, hasErrors, type ProductFormErrors } from "./validate";
import { createPayload, updatePayload } from "./payload";
import type { ProductDetail } from "./types";

const NO_ERRORS: ProductFormErrors = { variants: {} };

export function useProductForm(product?: ProductDetail) {
  const router = useRouter();
  const { name: nameParam } = useLocalSearchParams<{ name?: string }>();
  const { user } = useAuth();
  const { stores } = useManageScope();
  const { tree } = useTaxonomy();
  const { run, running } = useAction();
  const [values, setValues] = useState<ProductFormValues>(() => (product ? productToForm(product) : { ...emptyProductForm(), name: nameParam ?? "" }));
  const [errors, setErrors] = useState<ProductFormErrors>(NO_ERRORS);
  const [storeIds, setStoreIds] = useState<string[] | null>(null);
  const isEdit = !!product;
  const activeStores = useMemo(() => stores.filter((s) => s.status === "ACTIVE"), [stores]);
  const assignStores = !isEdit && !!user && user.role !== "SUPER_ADMIN" && activeStores.length > 0;
  const selectedStores = storeIds ?? activeStores.map((s) => s.id);

  useEffect(() => {
    if (!product?.subcategoryId || tree.length === 0) return;
    setValues((prev) => ({ ...prev, selection: selectionForSubcategory(tree, product.subcategoryId) }));
  }, [tree, product?.subcategoryId]);

  const patch = (next: Partial<ProductFormValues>) => setValues((prev) => ({ ...prev, ...next }));

  const save = async () => {
    const found = validateProductForm(values);
    setErrors(found);
    if (hasErrors(found)) return;
    if (product) {
      const saved = await run(() => api.put(`/api/v1/products/${product.id}`, updatePayload(values)), "Product saved");
      if (saved) router.back();
      return;
    }
    const created = await run(() => api.post<{ id: string }>("/api/v1/products", createPayload(values, assignStores ? selectedStores : undefined)), "Saved as draft");
    // Straight to the product to review it and launch
    if (created) router.replace(`/manage/products/${created.data.id}`);
  };

  const remove = async () => {
    if (!product) return false;
    const done = await run(() => api.delete(`/api/v1/products/${product.id}`), "Product deleted");
    // Back to the list that opened this product, not a fresh copy on top of the stack
    if (done) router.dismissTo("/manage/products");
    return !!done;
  };

  return { values, patch, errors, save, remove, running, isEdit, tree, assignStores, activeStores, selectedStores, setStoreIds };
}
