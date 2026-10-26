import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../constants/theme";
import { useLanguage } from "../../lib/language-context";
import { getBestPrice, useMembership } from "../../lib/membership-context";
import { useStrings } from "../../lib/i18n/use-strings";
import { formatDate } from "../../lib/i18n/format";
import type { MonthlyList, MonthlyListCheck } from "../../lib/types";
import { BottomSheet } from "../search/BottomSheet";
import { checkKey, type Verdict } from "./use-month-plan";

type Copy = { tag: string; tone: "amber" | "teal" | "slate"; image: string | null; title: string; body: string; no: string; yes: string; noDone: string; yesDone: string };
const TONES = { amber: ["#fef3c7", "#78350f"], teal: ["#ccfbf1", "#115e59"], slate: ["#f1f5f9", "#334155"] } as const;

// What a check says, in the shopper's language; null when its line has gone from the list
function useCopy(list: MonthlyList) {
  const t = useStrings("monthlyList");
  const { getLocalizedName } = useLanguage();
  const { isMember } = useMembership();
  return (c: MonthlyListCheck): Copy | null => {
    if (c.kind === "NEW_USUAL") {
      const name = getLocalizedName(c.product.product);
      return { tag: t.usualTag, tone: "teal", image: c.product.product.imageUrl ?? c.product.variant.imageUrl, title: t.usualTitle(`${name} ${c.product.variant.name}`), body: t.usualBody, no: t.notNow, yes: t.addToList, noDone: t.skipped, yesDone: t.added };
    }
    const item = list.items.find((i) => i.id === c.itemId);
    if (!item) return null;
    const name = getLocalizedName(item);
    const base = { image: item.imageUrl };
    if (c.kind === "OUT_OF_STOCK") {
      const swap = c.swap ? t.outSwap(`${getLocalizedName(c.swap.product)} ${c.swap.variant.name}`, `${Math.round(getBestPrice(c.swap, isMember))}`) : t.outNoSwap;
      return { ...base, tag: t.outTag, tone: "amber", title: t.outTitle(`${name} ${item.variantName}`), body: swap, no: t.leaveOut, yes: c.swap ? t.swap : "", noDone: t.leftOut, yesDone: t.swapped };
    }
    if (c.kind === "BIGGER_PACK") {
      const size = c.bigger.variant.name;
      const body = c.extra > 0 ? t.biggerUpsize(c.packs, size, `${c.extra}`, `${c.saving}`, item.variantName) : t.biggerBody(c.packs, size, `${c.saving}`);
      return { ...base, tag: t.biggerTag, tone: "teal", title: t.biggerTitle(name, size), body, no: t.keepSize(item.variantName), yes: t.switchSize(size), noDone: t.keptSize(item.variantName), yesDone: t.switched(size) };
    }
    const since = c.lastOrderedAt ? formatDate(c.lastOrderedAt, { month: "long" }) : "";
    return { ...base, tag: t.lapsedTag, tone: "slate", title: t.lapsedTitle(name), body: t.lapsedBody(since), no: t.removeFromList, yes: t.keepIt, noDone: t.removed, yesDone: t.kept };
  };
}

function Card({ copy, verdict, onAnswer }: { copy: Copy; verdict: Verdict | undefined; onAnswer: (v: Verdict) => void }) {
  const [bg, ink] = TONES[copy.tone];
  return (
    <View style={[styles.card, verdict && styles.cardDone]}>
      <View style={[styles.tag, { backgroundColor: bg }]}><Text style={[styles.tagText, { color: ink }]}>{copy.tag}</Text></View>
      <View style={styles.cardRow}>
        <View style={styles.thumbBox}>{copy.image && <Image source={{ uri: copy.image }} style={styles.thumb} />}</View>
        <View style={styles.cardText}>
          <Text style={styles.cardTitle}>{copy.title}</Text>
          <Text style={styles.cardBody}>{copy.body}</Text>
        </View>
      </View>
      {verdict ? (
        <View style={styles.done}>
          <Ionicons name="checkmark" size={16} color="#16a34a" />
          <Text style={styles.doneText}>{verdict === "yes" ? copy.yesDone : copy.noDone}</Text>
        </View>
      ) : (
        <View style={styles.actions}>
          <TouchableOpacity style={styles.no} onPress={() => onAnswer("no")} accessibilityRole="button"><Text style={styles.noText}>{copy.no}</Text></TouchableOpacity>
          {copy.yes !== "" && (
            <TouchableOpacity style={styles.yes} onPress={() => onAnswer("yes")} accessibilityRole="button"><Text style={styles.yesText}>{copy.yes}</Text></TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

interface Props {
  visible: boolean;
  list: MonthlyList;
  verdicts: Map<string, Verdict>;
  onAnswer: (check: MonthlyListCheck, verdict: Verdict) => void;
  onClose: () => void;
}

/** What changed since last month, each settled with a tap: swap or leave out, switch packs, drop or keep, add a usual */
export function ChangesSheet({ visible, list, verdicts, onAnswer, onClose }: Props) {
  const t = useStrings("monthlyList");
  const copyOf = useCopy(list);
  const footer = (
    <TouchableOpacity style={styles.back} onPress={onClose} accessibilityRole="button"><Text style={styles.backText}>{t.backToList}</Text></TouchableOpacity>
  );
  return (
    <BottomSheet visible={visible} title={t.changesTitle} onClose={onClose} footer={footer} scrollable>
      <Text style={styles.intro}>{t.changesIntro}</Text>
      {list.changes.map((c) => {
        const copy = copyOf(c);
        return copy && <Card key={checkKey(c)} copy={copy} verdict={verdicts.get(checkKey(c))} onAnswer={(v) => onAnswer(c, v)} />;
      })}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  intro: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 19, color: "#475569", marginBottom: 12 },
  card: { backgroundColor: "#ffffff", borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 12, gap: 10, marginBottom: 12 },
  cardDone: { opacity: 0.85 },
  tag: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  tagText: { fontFamily: fonts.extrabold, fontSize: 10, letterSpacing: 0.4 },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  thumbBox: { width: 56, height: 56, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center" },
  thumb: { width: 48, height: 48, resizeMode: "contain" },
  cardText: { flex: 1, gap: 2 },
  cardTitle: { fontFamily: fonts.extrabold, fontSize: 14, lineHeight: 19, color: colors.text },
  cardBody: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 17, color: "#475569" },
  actions: { flexDirection: "row", gap: 8 },
  no: { flex: 1, height: 44, borderRadius: 10, borderWidth: 1.5, borderColor: "#cbd5e1", alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  noText: { fontFamily: fonts.extrabold, fontSize: 13, color: colors.text, textAlign: "center" },
  yes: { flex: 1, height: 44, borderRadius: 10, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  yesText: { fontFamily: fonts.extrabold, fontSize: 13, color: "#ffffff", textAlign: "center" },
  done: { flexDirection: "row", alignItems: "center", gap: 6 },
  doneText: { fontFamily: fonts.extrabold, fontSize: 13, color: "#15803d" },
  back: { height: 52, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  backText: { fontFamily: fonts.extrabold, fontSize: 16, color: "#ffffff" },
});
