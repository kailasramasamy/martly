import { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Loader } from "../Loader";
import { RazorpayCheckout, type OrderPayment } from "../RazorpayCheckout";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { useToast } from "../../lib/toast-context";
import { useStrings } from "../../lib/i18n/use-strings";
import { colors, fontSize, fonts } from "../../constants/theme";

interface RazorpayData {
  razorpay_order_id: string;
  amount: number;
  currency: string;
  key_id: string;
  customer_id?: string;
}

interface Props {
  visible: boolean;
  /** Suggested amounts; the first is preselected */
  chips: number[];
  subtitle: string;
  /** Marks the first chip as the least that covers what the customer needs */
  firstIsMinimum?: boolean;
  onClose: () => void;
  onRecharged: () => void;
}

/** Add-money sheet: pick or type an amount, pay with Razorpay, and the server credits what it recorded for the order */
export function WalletRecharge({ visible, chips, subtitle, firstIsMinimum, onClose, onRecharged }: Props) {
  const t = useStrings("account").wallet.recharge;
  const { user } = useAuth();
  const toast = useToast();
  const [selected, setSelected] = useState(0);
  const [custom, setCustom] = useState("");
  const [starting, setStarting] = useState(false);
  const [checkout, setCheckout] = useState<RazorpayData | null>(null);
  // iOS can't present Razorpay while the sheet is still sliding away, so the order waits for the sheet to finish closing
  const [pending, setPending] = useState<RazorpayData | null>(null);

  const firstChip = chips[0] ?? 0;
  useEffect(() => {
    if (!visible) return;
    setSelected(firstChip);
    setCustom("");
  }, [visible, firstChip]);

  const amount = custom ? Number(custom) : selected;

  const start = async () => {
    if (!amount || amount < 1) {
      toast.show(t.invalidAmount, "error");
      return;
    }
    setStarting(true);
    try {
      const res = await api.post<RazorpayData>("/api/v1/wallet/recharge", { amount });
      if (Platform.OS === "ios") setPending(res.data);
      else setCheckout(res.data);
      onClose();
    } catch {
      toast.show(t.failed, "error");
    } finally {
      setStarting(false);
    }
  };

  const verify = async (payment: OrderPayment) => {
    setCheckout(null);
    try {
      await api.post("/api/v1/wallet/recharge/verify", payment);
      toast.show(t.success, "success");
    } catch {
      toast.show(t.verificationPending, "info");
    }
    onRecharged();
  };

  return (
    <>
      <RechargeSheet
        visible={visible} chips={chips} subtitle={subtitle} firstIsMinimum={firstIsMinimum}
        selected={selected} custom={custom} amount={amount} starting={starting}
        onSelect={(amt) => { setSelected(amt); setCustom(""); }} onCustom={setCustom} onSubmit={start} onClose={onClose}
        onDismissed={() => { setCheckout(pending); setPending(null); }}
      />
      {checkout && (
        <RazorpayCheckout
          visible
          keyId={checkout.key_id}
          orderId={checkout.razorpay_order_id}
          amount={checkout.amount}
          currency={checkout.currency}
          customerId={checkout.customer_id}
          description={t.paymentDescription}
          prefill={{ email: user?.email ?? "", contact: user?.phone ?? "", name: user?.name ?? "" }}
          onSuccess={verify}
          onCancel={() => setCheckout(null)}
        />
      )}
    </>
  );
}

interface SheetProps {
  visible: boolean;
  chips: number[];
  subtitle: string;
  firstIsMinimum?: boolean;
  selected: number;
  custom: string;
  amount: number;
  starting: boolean;
  onSelect: (amount: number) => void;
  onCustom: (text: string) => void;
  onSubmit: () => void;
  onClose: () => void;
  onDismissed: () => void;
}

function RechargeSheet(p: SheetProps) {
  const t = useStrings("account").wallet.recharge;
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={p.visible} transparent animationType="slide" onRequestClose={p.onClose} onDismiss={p.onDismissed}>
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={styles.overlay} onPress={p.onClose}>
          <Pressable style={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]} onPress={() => {}}>
            <View style={styles.handle} />
            <Text style={styles.title}>{t.title}</Text>
            <Text style={styles.subtitle}>{p.subtitle}</Text>
            <View style={styles.chipRow}>
              {p.chips.map((amt, i) => {
                const active = !p.custom && p.selected === amt;
                return (
                  <TouchableOpacity key={amt} style={[styles.chip, active && styles.chipActive]} activeOpacity={0.7} onPress={() => p.onSelect(amt)}>
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{"₹"}{amt}</Text>
                    {p.firstIsMinimum && i === 0 && <Text style={[styles.chipHint, active && styles.chipTextActive]}>{t.min}</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.customRow}>
              <Text style={styles.customLabel}>{t.orEnter}</Text>
              <View style={styles.customInputWrap}>
                <Text style={styles.customPrefix}>{"₹"}</Text>
                <TextInput
                  style={styles.customInput}
                  keyboardType="number-pad"
                  value={p.custom}
                  onChangeText={(text) => p.onCustom(text.replace(/[^0-9]/g, ""))}
                />
              </View>
            </View>
            <TouchableOpacity style={[styles.submit, p.starting && styles.submitDisabled]} activeOpacity={0.8} onPress={p.onSubmit} disabled={p.starting}>
              {p.starting ? <Loader size="small" color="#fff" /> : <Text style={styles.submitText}>{t.add(p.amount || 0)}</Text>}
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboard: { flex: 1 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  content: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 12 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#d1d5db", alignSelf: "center", marginBottom: 16 },
  title: { fontSize: fontSize.xl, fontFamily: fonts.bold, color: colors.text },
  subtitle: { fontSize: fontSize.sm, fontFamily: fonts.regular, color: colors.textSecondary, marginTop: 4, marginBottom: 20 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  chip: {
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5,
    borderColor: colors.border, backgroundColor: "#fff", alignItems: "center", minHeight: 44, justifyContent: "center",
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primary + "0D" },
  chipText: { fontSize: fontSize.md, fontFamily: fonts.semibold, color: colors.text },
  chipTextActive: { color: colors.primary },
  chipHint: { fontSize: 10, fontFamily: fonts.medium, color: colors.textSecondary, marginTop: 1 },
  customRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  customLabel: { fontSize: fontSize.sm, fontFamily: fonts.medium, color: colors.textSecondary },
  customInputWrap: {
    flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, width: 130,
  },
  customPrefix: { fontSize: fontSize.md, fontFamily: fonts.semibold, color: colors.textSecondary, marginRight: 4 },
  customInput: { flex: 1, fontSize: fontSize.md, fontFamily: fonts.semibold, color: colors.text, paddingVertical: 10 },
  submit: { backgroundColor: colors.primary, paddingVertical: 14, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  submitDisabled: { opacity: 0.7 },
  submitText: { fontSize: fontSize.md, fontFamily: fonts.semibold, color: "#fff" },
});
