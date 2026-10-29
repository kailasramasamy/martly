import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SectionCard } from "../ui/SectionCard";
import { Button } from "../ui/Button";
import { formatINR, manage } from "../ui/tokens";
import { colors, fonts } from "../../../constants/theme";
import type { AdProduct } from "./plan-types";

const MIN_QTY = 1;
const MAX_QTY = 12;

interface TopUpProps {
  title: string;
  description: string;
  /** Where the allowance stands, shown above the description */
  status?: string;
  product: AdProduct;
  quantity: number;
  onQuantity: (n: number) => void;
  canBuy: boolean;
  busy: boolean;
  /** Another purchase is running: this one waits, without spinning */
  locked: boolean;
  onBuy: () => void;
  /** Set when the ledger balance covers the total */
  onBuyFromBalance?: () => void;
}

export function TopUpCard({ title, description, status, product, quantity, onQuantity, canBuy, busy, locked, onBuy, onBuyFromBalance }: TopUpProps) {
  return (
    <SectionCard title={title}>
      {status ? <Text style={styles.status}>{status}</Text> : null}
      <Text style={styles.muted}>{description}</Text>
      <View style={styles.stepper}>
        <StepButton icon="remove" label="Fewer" disabled={quantity <= MIN_QTY} onPress={() => onQuantity(quantity - 1)} />
        <Text style={styles.qty}>{quantity}</Text>
        <StepButton icon="add" label="More" disabled={quantity >= MAX_QTY} onPress={() => onQuantity(quantity + 1)} />
      </View>
      <Button label={`Buy ${quantity} for ${formatINR(product.price * quantity)}`} onPress={onBuy} disabled={!canBuy || locked} loading={busy} style={styles.buy} />
      {onBuyFromBalance ? <Button label="Pay from balance" icon="wallet-outline" variant="secondary" onPress={onBuyFromBalance} disabled={!canBuy || locked} style={styles.buy} /> : null}
    </SectionCard>
  );
}

function StepButton({ icon, label, disabled, onPress }: { icon: "add" | "remove"; label: string; disabled: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.step, disabled && styles.stepOff]} onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label}>
      <Ionicons name={icon} size={20} color={colors.text} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  muted: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, marginTop: 4, lineHeight: 18 },
  status: { fontFamily: fonts.bold, fontSize: 13, color: colors.text, marginTop: 4 },
  buy: { marginTop: 12 },
  stepper: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 20, marginTop: 12 },
  step: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: manage.line, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  stepOff: { opacity: 0.4 },
  qty: { fontFamily: fonts.extrabold, fontSize: 22, color: colors.text, minWidth: 32, textAlign: "center" },
});
