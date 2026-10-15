import { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { fonts, colors } from "../../../constants/theme";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import { useToast } from "../../../lib/toast-context";
import { SectionCard } from "../ui/SectionCard";
import { SelectField } from "../ui/SelectField";
import { TextField } from "../ui/TextField";
import { Button } from "../ui/Button";
import type { CatalogProduct, StoreProductItem } from "./types";

interface ListInStoreFormProps {
  product: CatalogProduct;
  storeId: string | null;
  /** Variants already in the store; they can't be chosen again */
  listedVariantIds?: string[];
  onChangeProduct: () => void;
  onListed: () => void;
}

/** Variant, price and opening stock for listing one catalog product in a store */
export function ListInStoreForm({ product, storeId, listedVariantIds = [], onChangeProduct, onListed }: ListInStoreFormProps) {
  const toast = useToast();
  const { run, running } = useAction();
  const available = product.variants.filter((v) => !listedVariantIds.includes(v.id));
  const only = available.length === 1 ? available[0] : null;
  const [variantId, setVariantId] = useState<string | null>(only?.id ?? null);
  const [price, setPrice] = useState(only?.mrp ? String(Number(only.mrp)) : "");
  const [stock, setStock] = useState("0");

  const chooseVariant = (id: string) => {
    setVariantId(id);
    const mrp = product.variants.find((v) => v.id === id)?.mrp;
    if (mrp && !price) setPrice(String(Number(mrp)));
  };

  const submit = async () => {
    const stockNum = Number(stock);
    if (!storeId || !variantId) return toast.show("Choose a store and variant", "error");
    if (!(Number(price) > 0)) return toast.show("Enter a price above zero", "error");
    if (!Number.isInteger(stockNum) || stockNum < 0) return toast.show("Stock must be a whole number", "error");
    const res = await run(() => api.post<StoreProductItem>("/api/v1/store-products", { storeId, variantId, price: Number(price), stock: stockNum }), "Added to store");
    if (res) onListed();
  };

  return (
    <SectionCard title="Product" action={{ label: "Change", onPress: onChangeProduct }}>
      <Text style={styles.name}>{product.name}</Text>
      <View style={styles.fields}>
        <SelectField
          label="Variant"
          required
          value={variantId}
          options={available.map((v) => ({ value: v.id, label: v.name }))}
          onChange={chooseVariant}
          placeholder="Choose a variant"
        />
        <TextField label="Price" required value={price} onChangeText={setPrice} keyboardType="decimal-pad" prefix={"₹"} />
        <TextField label="Opening stock" value={stock} onChangeText={(t) => setStock(t.replace(/[^0-9]/g, ""))} keyboardType="number-pad" />
      </View>
      <Button label="Add to store" onPress={submit} loading={running} style={styles.submit} />
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  name: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  fields: { marginTop: 12, gap: 4 },
  submit: { marginTop: 12 },
});
