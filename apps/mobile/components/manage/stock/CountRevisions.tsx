import { View, Text, StyleSheet } from "react-native";
import { colors, fonts } from "../../../constants/theme";
import { timeAgo } from "../ui/dates";
import { manage, tabular } from "../ui/tokens";
import type { CountRevision } from "./types";

const VERB: Record<CountRevision["kind"], string> = {
  COUNT: "Counted",
  RECOUNT: "Recounted",
  CORRECTION: "Corrected to",
};

/** Oldest-first history of who set what quantity on a line */
export function CountRevisions({ revisions }: { revisions: CountRevision[] }) {
  return (
    <View style={styles.list}>
      {revisions.map((r, i) => (
        <View key={`${r.createdAt}-${i}`} style={styles.item}>
          <Text style={styles.line}>
            {VERB[r.kind]} <Text style={[styles.qty, tabular]}>{r.qty}</Text>
            <Text style={styles.meta}> {"·"} {r.userName} {"·"} {timeAgo(r.createdAt)}</Text>
          </Text>
          {r.reason ? <Text style={styles.reason}>{r.reason}</Text> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  item: { borderLeftWidth: 2, borderLeftColor: manage.line, paddingLeft: 10 },
  line: { fontFamily: fonts.medium, fontSize: 14, color: colors.text },
  qty: { fontFamily: fonts.extrabold },
  meta: { color: colors.textSecondary, fontSize: 12.5 },
  reason: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, marginTop: 2 },
});
