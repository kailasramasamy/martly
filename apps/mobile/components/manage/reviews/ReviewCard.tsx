import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius } from "../../../constants/theme";
import { Button } from "../ui/Button";
import { StatusPill } from "../ui/StatusPill";
import { formatDate } from "../ui/dates";
import { manage } from "../ui/tokens";
import { Stars } from "./Stars";
import { REVIEW_STATUS, type ModerationReview } from "./types";

interface ReviewCardProps {
  review: ModerationReview;
  selected: boolean;
  selecting: boolean;
  busy: boolean;
  onToggle: () => void;
  onStatus: (status: "APPROVED" | "REJECTED") => void;
  onReply: () => void;
  onDeleteReply: () => void;
}

export function ReviewCard({ review: r, selected, selecting, busy, onToggle, onStatus, onReply, onDeleteReply }: ReviewCardProps) {
  return (
    <TouchableOpacity
      style={[styles.card, selected && styles.selected]}
      onPress={selecting ? onToggle : undefined}
      onLongPress={onToggle}
      activeOpacity={selecting ? 0.7 : 1}
    >
      <View style={styles.head}>
        {selecting && <Ionicons name={selected ? "checkbox" : "square-outline"} size={22} color={selected ? colors.primary : manage.muted} />}
        {r.product.imageUrl ? <Image source={{ uri: r.product.imageUrl }} style={styles.thumb} /> : <View style={[styles.thumb, styles.thumbEmpty]} />}
        <View style={styles.headText}>
          <Text style={styles.product} numberOfLines={1}>{r.product.name}</Text>
          <Text style={styles.meta} numberOfLines={1}>{r.user.name} · {formatDate(r.createdAt)}</Text>
        </View>
        <StatusPill {...REVIEW_STATUS[r.status]} />
      </View>

      <View style={styles.ratingRow}>
        <Stars value={r.rating} />
        {r.isVerified && <Text style={styles.verified}>Verified purchase</Text>}
      </View>
      {r.title ? <Text style={styles.title}>{r.title}</Text> : null}
      {r.comment ? <Text style={styles.comment}>{r.comment}</Text> : null}
      {r.images.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.images}>
          {r.images.map((img) => <Image key={img.id} source={{ uri: img.imageUrl }} style={styles.image} />)}
        </ScrollView>
      )}

      {r.reply && (
        <View style={styles.reply}>
          <Text style={styles.replyLabel}>Reply from {r.reply.user.name}</Text>
          <Text style={styles.replyBody}>{r.reply.body}</Text>
        </View>
      )}

      {!selecting && (
        <View style={styles.actions}>
          {r.status !== "APPROVED" && <Button label="Approve" icon="checkmark" compact loading={busy} onPress={() => onStatus("APPROVED")} />}
          {r.status !== "REJECTED" && <Button label="Reject" icon="close" variant="danger" compact disabled={busy} onPress={() => onStatus("REJECTED")} />}
          <Button label={r.reply ? "Edit reply" : "Reply"} icon="chatbubble-outline" variant="secondary" compact onPress={onReply} />
          {r.reply && <Button label="Delete reply" variant="ghost" compact onPress={onDeleteReply} />}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: manage.card, borderBottomWidth: 1, borderBottomColor: manage.line, padding: 14, gap: 8 },
  selected: { backgroundColor: manage.tint },
  head: { flexDirection: "row", alignItems: "center", gap: 10 },
  thumb: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: manage.canvas },
  thumbEmpty: { borderWidth: 1, borderColor: manage.line },
  headText: { flex: 1, minWidth: 0 },
  product: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  meta: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  verified: { fontFamily: fonts.semibold, fontSize: 11.5, color: "#15803d" },
  title: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  comment: { fontFamily: fonts.medium, fontSize: 14, color: colors.text, lineHeight: 20 },
  images: { gap: 8 },
  image: { width: 72, height: 72, borderRadius: radius.md, backgroundColor: manage.canvas },
  reply: { backgroundColor: manage.canvas, borderRadius: radius.md, padding: 10, borderLeftWidth: 3, borderLeftColor: colors.primary },
  replyLabel: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.primary, marginBottom: 2 },
  replyBody: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.text, lineHeight: 19 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
});
