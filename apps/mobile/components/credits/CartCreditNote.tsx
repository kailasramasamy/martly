import { View, StyleSheet } from "react-native";
import { useCredits } from "../../lib/credits-context";
import { CreditStrip } from "./CreditStrip";

/** Under the cart header while welcome credit is unused: days left, or how much more the cart needs to use it */
export function CartCreditNote({ itemTotal }: { itemTotal: number }) {
  const { isCustomer, storeGrants } = useCredits();
  if (!isCustomer || storeGrants.length === 0) return null;
  return (
    <View style={styles.wrap}>
      <CreditStrip grants={storeGrants} itemTotal={itemTotal} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 12 },
});
