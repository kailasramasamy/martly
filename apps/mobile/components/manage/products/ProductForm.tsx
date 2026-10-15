import { useState, type ReactNode } from "react";
import { View } from "react-native";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { ManageStackScreen } from "../ManageStackScreen";
import { Button } from "../ui/Button";
import { SegmentedTabs } from "../ui/SegmentedTabs";
import { useBrandOptions } from "./use-brand-options";
import { useProductForm } from "./use-product-form";
import { BasicSection } from "./BasicSection";
import { ImagesSection } from "./ImagesSection";
import { VariantsSection } from "./VariantsSection";
import { DetailsSection } from "./DetailsSection";
import { ComplianceSection } from "./ComplianceSection";
import { TranslationsSection } from "./TranslationsSection";
import { StoreAssignSection } from "./StoreAssignSection";
import { useFormTabs, type FormTab } from "./use-form-tabs";
import { validateProductForm } from "./validate";
import type { ProductDetail } from "./types";

/** Keeps every section mounted so in-progress edits survive switching tabs */
function Tab({ show, children }: { show: boolean; children: ReactNode }) {
  return <View style={{ display: show ? "flex" : "none" }}>{children}</View>;
}

/** Create (no product) or edit (product) form, one section per tab */
export function ProductForm({ product }: { product?: ProductDetail }) {
  const form = useProductForm(product);
  const brandOptions = useBrandOptions();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const section = { values: form.values, onChange: form.patch, errors: form.errors };
  const tabs = useFormTabs(form.errors, form.assignStores);
  const on = (t: FormTab) => tabs.tab === t;
  const save = () => {
    tabs.showFirstError(validateProductForm(form.values));
    return form.save();
  };

  const actions = (
    <>
      {form.isEdit && <Button label="Delete" variant="danger" onPress={() => setConfirmDelete(true)} style={{ flex: 1 }} />}
      <Button label={form.isEdit ? "Save changes" : "Create product"} onPress={save} loading={form.running} style={{ flex: 2 }} />
    </>
  );

  return (
    <ManageStackScreen
      title={form.isEdit ? "Edit product" : "New product"}
      actions={actions}
      toolbar={<SegmentedTabs options={tabs.options} value={tabs.tab} onChange={tabs.setTab} />}
      scrollKey={tabs.tab}
    >
      <Tab show={on("basic")}><BasicSection {...section} tree={form.tree} brandOptions={brandOptions} showActive={form.isEdit} /></Tab>
      <Tab show={on("photos")}><ImagesSection {...section} /></Tab>
      <Tab show={on("sizes")}><VariantsSection {...section} mode={form.isEdit ? "edit" : "create"} /></Tab>
      <Tab show={on("details")}><DetailsSection {...section} /></Tab>
      <Tab show={on("compliance")}><ComplianceSection {...section} /></Tab>
      <Tab show={on("translations")}><TranslationsSection {...section} /></Tab>
      {form.assignStores && (
        <Tab show={on("stores")}><StoreAssignSection stores={form.activeStores} selected={form.selectedStores} onChange={form.setStoreIds} /></Tab>
      )}
      <ConfirmDialog
        visible={confirmDelete}
        title="Delete product?"
        message="This removes the product, its variants and its store listings. This cannot be undone."
        confirmLabel="Delete"
        running={form.running}
        onConfirm={async () => {
          await form.remove();
          setConfirmDelete(false);
        }}
        onClose={() => setConfirmDelete(false)}
      />
    </ManageStackScreen>
  );
}
