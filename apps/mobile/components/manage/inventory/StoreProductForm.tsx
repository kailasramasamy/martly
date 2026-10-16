import { View, StyleSheet } from "react-native";
import { SectionCard } from "../ui/SectionCard";
import { TextField } from "../ui/TextField";
import { SwitchRow } from "../ui/SwitchRow";
import { KeyValue } from "../ui/KeyValue";
import { formatINR, manage } from "../ui/tokens";
import type { StoreProductDraft } from "./draft";
import { StockStepper } from "./StockStepper";
import { DiscountFields } from "./DiscountFields";
import { ListingHeader } from "./ListingHeader";
import { PricePreview } from "./PricePreview";
import { ProductDetailsLink } from "./ProductDetailsLink";
import type { ListingAccess } from "./use-listing-access";
import type { StoreProductItem } from "./types";

interface StoreProductFormProps {
  item: StoreProductItem;
  draft: StoreProductDraft;
  onChange: (patch: Partial<StoreProductDraft>) => void;
  /** What the member may change; everything else shows as plain values */
  access: ListingAccess;
}

type DraftProps = Pick<StoreProductFormProps, "draft" | "onChange">;

function discountLabel(draft: StoreProductDraft): string {
  if (draft.discountMode === "NONE" || !draft.discountValue) return "None";
  return draft.discountMode === "FLAT" ? `${formatINR(Number(draft.discountValue))} off` : `${draft.discountValue}% off`;
}

function PricingFields({ draft, onChange }: DraftProps) {
  return (
    <>
      <TextField label="Selling price" value={draft.price} onChangeText={(price) => onChange({ price })} keyboardType="decimal-pad" prefix={"₹"} />
      <DiscountFields draft={draft} onChange={onChange} withDates />
      <View style={styles.preview}><PricePreview draft={draft} /></View>
      <TextField
        label="Member price"
        hint="Special price for Mart Plus members. Leave empty for none."
        value={draft.memberPrice}
        onChangeText={(memberPrice) => onChange({ memberPrice })}
        keyboardType="decimal-pad"
        prefix={"₹"}
      />
    </>
  );
}

function PricingValues({ draft }: { draft: StoreProductDraft }) {
  return (
    <>
      <KeyValue label="Selling price" value={formatINR(Number(draft.price), { decimals: true })} />
      <KeyValue label="Discount" value={discountLabel(draft)} />
      <KeyValue label="Member price" value={draft.memberPrice ? formatINR(Number(draft.memberPrice), { decimals: true }) : "None"} />
      {draft.discountMode !== "NONE" && <View style={styles.preview}><PricePreview draft={draft} /></View>}
    </>
  );
}

export function StoreProductForm({ item, draft, onChange, access }: StoreProductFormProps) {
  return (
    <>
      <SectionCard>
        <ListingHeader item={item} available={(Number(draft.stock) || 0) - item.reservedStock} />
        <ProductDetailsLink item={item} />
      </SectionCard>
      <SectionCard title="Stock">
        {access.stock
          ? <StockStepper value={draft.stock} onChange={(stock) => onChange({ stock })} reserved={item.reservedStock} />
          : <>
              <KeyValue label="On hand" value={draft.stock} />
              {item.reservedStock > 0 ? <KeyValue label="Reserved in orders" value={item.reservedStock} /> : null}
            </>}
      </SectionCard>
      <SectionCard title="Pricing">
        {access.prices ? <PricingFields draft={draft} onChange={onChange} /> : <PricingValues draft={draft} />}
      </SectionCard>
      <SectionCard title="Visibility">
        <SwitchRow label="Listed" description="Customers can see and buy this" value={draft.isActive} onValueChange={(isActive) => onChange({ isActive })} disabled={!access.listed} />
        <View style={styles.divider} />
        <SwitchRow label="Featured" description="Highlighted on the store's home screen" value={draft.isFeatured} onValueChange={(isFeatured) => onChange({ isFeatured })} disabled={!access.featured} />
      </SectionCard>
    </>
  );
}

const styles = StyleSheet.create({
  preview: { marginTop: 4, marginBottom: 14 },
  divider: { height: 1, backgroundColor: manage.hairline, marginVertical: 4 },
});
