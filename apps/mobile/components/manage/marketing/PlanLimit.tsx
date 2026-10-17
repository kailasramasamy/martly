import { useCallback, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Button } from "../ui/Button";
import { ApiError } from "../../../lib/api";
import { colors, fonts, radius } from "../../../constants/theme";
import { manage } from "../ui/tokens";

/** Remembers the message of a 402 (plan limit reached) so the screen can offer the Marketing plan next to it */
export function usePlanLimit() {
  const [message, setMessage] = useState<string | null>(null);
  const capture = useCallback(async <R,>(call: () => Promise<R>): Promise<R> => {
    setMessage(null);
    try {
      return await call();
    } catch (err) {
      if (err instanceof ApiError && err.status === 402) setMessage(err.message);
      throw err;
    }
  }, []);
  return { message, capture };
}

export function PlanLimitNotice({ message }: { message: string | null }) {
  const router = useRouter();
  if (!message) return null;
  return (
    <View style={styles.box}>
      <Text style={styles.text}>{message}</Text>
      <Button label="Open Marketing plan" variant="secondary" compact onPress={() => router.push("/manage/marketing-plan")} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 8, padding: 12, borderRadius: radius.md, backgroundColor: manage.attentionBg, alignItems: "flex-start" },
  text: { fontFamily: fonts.medium, fontSize: 13.5, color: manage.attentionText, lineHeight: 19 },
});
