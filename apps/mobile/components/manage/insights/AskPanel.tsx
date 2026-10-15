import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius } from "../../../constants/theme";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import { SectionCard } from "../ui/SectionCard";
import { TextField } from "../ui/TextField";
import { Button } from "../ui/Button";
import { KpiTile } from "../ui/KpiTile";
import { manage } from "../ui/tokens";
import type { AskResult } from "./types";

const SUGGESTIONS = [
  "How did I do last week?",
  "What's my best selling product?",
  "How are my customers doing?",
  "What payment methods do people prefer?",
  "How's my store rating?",
];

const DIRECTION_COLOR = { up: "#15803d", down: colors.error, neutral: colors.textSecondary };

function Result({ result }: { result: AskResult }) {
  return (
    <>
      <SectionCard><Text style={styles.headline}>{result.headline}</Text></SectionCard>
      {result.highlights.length > 0 && (
        <View style={styles.tiles}>
          {result.highlights.map((h) => (
            <View key={h.label} style={styles.tile}>
              <KpiTile label={h.label} value={h.value} />
              {h.change ? <Text style={[styles.change, { color: DIRECTION_COLOR[h.direction] }]}>{h.change}</Text> : null}
            </View>
          ))}
        </View>
      )}
      {result.insights.length > 0 && (
        <SectionCard title="Key insights">
          {result.insights.map((i) => (
            <View key={i.label} style={styles.insight}>
              <Text style={styles.insightLabel}>{i.label}</Text>
              <Text style={styles.insightDetail}>{i.detail}</Text>
            </View>
          ))}
        </SectionCard>
      )}
      {result.tip ? (
        <View style={styles.tip}>
          <Ionicons name="bulb-outline" size={18} color={manage.attentionText} />
          <Text style={styles.tipText}>{result.tip}</Text>
        </View>
      ) : null}
    </>
  );
}

export function AskPanel({ storeId }: { storeId: string }) {
  const { run, running } = useAction();
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<AskResult | null>(null);

  const ask = async (q: string) => {
    if (!q.trim()) return;
    setResult(null);
    const res = await run(() => api.post<AskResult>("/api/v1/customer-insights/ask", { storeId, question: q.trim() }));
    if (res) setResult(res.data);
  };

  return (
    <View style={styles.root}>
      <View style={styles.chips}>
        {SUGGESTIONS.map((q) => (
          <TouchableOpacity key={q} style={styles.chip} onPress={() => { setQuestion(q); ask(q); }} disabled={running}>
            <Text style={styles.chipText}>{q}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TextField label="Ask anything about your store" value={question} onChangeText={setQuestion} multiline maxLength={300} placeholder="e.g. Which day is busiest?" />
      <Button label="Ask" icon="sparkles-outline" loading={running} disabled={!question.trim()} onPress={() => ask(question)} />
      {result && <Result result={result} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 14 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: 36, justifyContent: "center", paddingHorizontal: 12, borderRadius: 18, backgroundColor: manage.tint, borderWidth: 1, borderColor: manage.line },
  chipText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.primary },
  headline: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 22, color: colors.text },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: { width: "48%" },
  change: { fontFamily: fonts.bold, fontSize: 12, marginTop: 4 },
  insight: { paddingVertical: 6 },
  insightLabel: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary },
  insightDetail: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: colors.text, marginTop: 2 },
  tip: { flexDirection: "row", gap: 10, padding: 12, borderRadius: radius.lg, backgroundColor: manage.attentionBg },
  tipText: { flex: 1, fontFamily: fonts.semibold, fontSize: 13.5, lineHeight: 19, color: manage.attentionText },
});
