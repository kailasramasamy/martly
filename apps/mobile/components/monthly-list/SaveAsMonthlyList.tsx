import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { CreateMonthlyListInput } from "@martly/shared/schemas";
import { colors, fonts } from "../../constants/theme";
import { api, ApiError } from "../../lib/api";
import { useToast } from "../../lib/toast-context";
import { useStrings } from "../../lib/i18n/use-strings";
import type { MonthlyList } from "../../lib/types";
import { SetupSheet, type ListSettings } from "./SetupSheet";

type Source = Pick<CreateMonthlyListInput, "source" | "orderId" | "lines">;

interface Props {
  storeId: string;
  /** An order to start from, or lines (the cart) */
  from: Source;
  label: string;
}

/** Starts (or replaces) the shopper's monthly list at a store from an order or the cart, then opens it */
export function SaveAsMonthlyList({ storeId, from, label }: Props) {
  const t = useStrings("monthlyList");
  const toast = useToast();
  const [existing, setExisting] = useState<ListSettings | null>(null);
  const [open, setOpen] = useState(false);

  // An existing list keeps its day and reminders, and the sheet says it will be replaced
  const start = async () => {
    try {
      const res = await api.get<MonthlyList>(`/api/v1/monthly-list?storeId=${storeId}`);
      const { reminderDay, pushOn, whatsappOn } = res.data;
      setExisting({ reminderDay, pushOn, whatsappOn, isActive: true });
    } catch (err) {
      if (!(err instanceof ApiError || err instanceof TypeError)) throw err;
      setExisting(null);
    }
    setOpen(true);
  };

  const save = async ({ reminderDay, pushOn, whatsappOn }: ListSettings) => {
    try {
      await api.post<MonthlyList>("/api/v1/monthly-list", { storeId, ...from, reminderDay, pushOn, whatsappOn });
    } catch (err) {
      if (!(err instanceof ApiError || err instanceof TypeError)) throw err;
      toast.show(err instanceof ApiError && err.status !== 404 ? err.message : t.noOrder, "error");
      return false;
    }
    toast.show(t.saved, "success");
    router.push("/monthly-list");
    return true;
  };

  return (
    <>
      <TouchableOpacity style={styles.button} onPress={start} activeOpacity={0.8} accessibilityRole="button">
        <Ionicons name="calendar-outline" size={18} color={colors.primary} />
        <Text style={styles.text}>{label}</Text>
      </TouchableOpacity>
      <SetupSheet visible={open} initial={existing} editing={false} replaces={existing !== null} onSave={save} onClose={() => setOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  button: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 48, borderRadius: 12, borderWidth: 1.5, borderColor: colors.primary, borderStyle: "dashed", backgroundColor: "#f0fdfa", paddingHorizontal: 14 },
  text: { fontFamily: fonts.extrabold, fontSize: 14, color: colors.primary },
});
