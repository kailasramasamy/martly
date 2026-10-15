import { View, StyleSheet } from "react-native";
import { SectionCard } from "../ui/SectionCard";
import { TextField } from "../ui/TextField";
import { SwitchRow } from "../ui/SwitchRow";
import { manage } from "../ui/tokens";
import type { StoreProductDraft } from "./draft";
import { StockStepper } from "./StockStepper";
import { DiscountFields } from "./DiscountFields";
import { ListingHeader } from "./ListingHeader";
import { PricePreview } from "./PricePreview";
import { ProductDetailsLink } from "./ProductDetailsLink";
import type { StoreProductItem } from "./types";

interface StoreProductFormProps {
  item: StoreProductItem;
  draft: StoreProductDraft;
  onChange: (patch: Partial<StoreProductDraft>) => void;
  readOnly: boolean;
}

function PricingCard({ draft, onChange, readOnly }: Omit<StoreProductFormProps, "item">) {
  return (
    <SectionCard title="Pricing">
      <TextField label="Selling price" value={draft.price} onChangeText={(price) => onChange({ price })} keyboardType="decimal-pad" prefix={"₹"} editable={!readOnly} />
      <DiscountFields draft={draft} onChange={onChange} withDates />
      <View style={styles.preview}><PricePreview draft={draft} /></View>
      <TextField
        label="Member price"
        hint="Special price for Mart Plus members. Leave empty for none."
        value={draft.memberPrice}
        onChangeText={(memberPrice) => onChange({ memberPrice })}
        keyboardType="decimal-pad"
        prefix={"₹"}
        editable={!readOnly}
      />
    </SectionCard>
  );
}

export function StoreProductForm({ item, draft, onChange, readOnly }: StoreProductFormProps) {
  return (
    <>
      <SectionCard>
        <ListingHeader item={item} available={(Number(draft.stock) || 0) - item.reservedStock} />
        <ProductDetailsLink item={item} />
      </SectionCard>
      <SectionCard title="Stock">
        <StockStepper value={draft.stock} onChange={(stock) => onChange({ stock })} reserved={item.reservedStock} />
      </SectionCard>
      <PricingCard draft={draft} onChange={onChange} readOnly={readOnly} />
      <SectionCard title="Visibility">
        <SwitchRow label="Listed" description="Customers can see and buy this" value={draft.isActive} onValueChange={(isActive) => onChange({ isActive })} disabled={readOnly} />
        <View style={styles.divider} />
        <SwitchRow label="Featured" description="Highlighted on the store's home screen" value={draft.isFeatured} onValueChange={(isFeatured) => onChange({ isFeatured })} disabled={readOnly} />
      </SectionCard>
    </>
  );
}

const styles = StyleSheet.create({
  preview: { marginTop: 4, marginBottom: 14 },
  divider: { height: 1, backgroundColor: manage.hairline, marginVertical: 4 },
});
