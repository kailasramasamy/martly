import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { Loader } from "../Loader";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../constants/theme";
import { useLanguage } from "../../lib/language-context";
import { useStrings } from "../../lib/i18n/use-strings";
import { BottomSheet } from "../search/BottomSheet";
import type { OrderData } from "./types";
import type { RatingDraft, useOrderRatings } from "./use-order-ratings";

type Ratings = ReturnType<typeof useOrderRatings>;

function Stars({ value, onChange, size = 26 }: { value: number; onChange?: (n: number) => void; size?: number }) {
  return (
    <View style={styles.stars}>
      {[1, 2, 3, 4, 5].map((s) => {
        const star = <Ionicons name={s <= value ? "star" : "star-outline"} size={size} color={s <= value ? "#f59e0b" : "#cbd5e1"} />;
        return onChange
          ? <TouchableOpacity key={s} onPress={() => onChange(s)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>{star}</TouchableOpacity>
          : <View key={s}>{star}</View>;
      })}
    </View>
  );
}

function StoreRating({ ratings }: { ratings: Ratings }) {
  const t = useStrings("orders").detail;
  const { storeRating, draft, setDraft } = ratings;
  const rows: { key: keyof RatingDraft; label: string; value: number }[] = storeRating
    ? [{ key: "overall", label: t.overall, value: storeRating.overallRating }, { key: "delivery", label: t.delivery, value: storeRating.deliveryRating ?? 0 }, { key: "packaging", label: t.packaging, value: storeRating.packagingRating ?? 0 }]
    : [{ key: "overall", label: t.overall, value: draft.overall }, { key: "delivery", label: t.delivery, value: draft.delivery }, { key: "packaging", label: t.packaging, value: draft.packaging }];
  return (
    <View style={styles.block}>
      <Text style={styles.blockTitle}>{storeRating ? t.thanksFeedback : t.rateExperience}</Text>
      {rows.filter((r) => !storeRating || r.value > 0).map((r) => (
        <View key={r.key} style={styles.row}>
          <Text style={styles.rowLabel}>{r.label}</Text>
          <Stars value={r.value} onChange={storeRating ? undefined : (n) => setDraft((d) => ({ ...d, [r.key]: n }))} />
        </View>
      ))}
      {storeRating ? (storeRating.comment ? <Text style={styles.comment}>"{storeRating.comment}"</Text> : null) : (
        <TextInput style={styles.input} value={draft.comment} onChangeText={(comment) => setDraft((d) => ({ ...d, comment }))} placeholder={t.commentPlaceholder} placeholderTextColor="#94a3b8" multiline maxLength={500} />
      )}
    </View>
  );
}

function ProductReviews({ order, ratings, onClose }: { order: OrderData; ratings: Ratings; onClose: () => void }) {
  const router = useRouter();
  const t = useStrings("orders").detail;
  const { getLocalizedName } = useLanguage();
  const write = (productId: string, name: string) => {
    onClose();
    router.push({ pathname: "/write-review", params: { productId, productName: name, storeId: order.storeId, orderId: order.id } });
  };
  return (
    <View style={styles.block}>
      <Text style={styles.blockTitle}>{t.rateProducts}</Text>
      {order.items.map((item) => {
        const review = ratings.reviews.find((r) => r.productId === item.productId);
        const name = getLocalizedName(item.product);
        return (
          <View key={item.id} style={styles.row}>
            <Text style={styles.productName} numberOfLines={1}>{name}</Text>
            {review ? <Stars value={review.rating} size={15} /> : (
              <TouchableOpacity style={styles.reviewBtn} onPress={() => write(item.productId, name)}>
                <Text style={styles.reviewText}>{t.review}</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </View>
  );
}

export function RateOrderSheet({ visible, order, ratings, onClose }: { visible: boolean; order: OrderData; ratings: Ratings; onClose: () => void }) {
  const t = useStrings("orders").detail;
  const canSubmit = !ratings.storeRating && ratings.draft.overall > 0;
  const footer = ratings.storeRating ? undefined : (
    <TouchableOpacity style={[styles.submit, !canSubmit && { opacity: 0.4 }]} disabled={!canSubmit || ratings.submitting} onPress={async () => { if (await ratings.submit()) onClose(); }}>
      {ratings.submitting ? <Loader color="#fff" /> : <Text style={styles.submitText}>{t.submitRating}</Text>}
    </TouchableOpacity>
  );
  return (
    <BottomSheet visible={visible} title={t.rateOrder} onClose={onClose} footer={footer} scrollable>
      <StoreRating ratings={ratings} />
      <ProductReviews order={order} ratings={ratings} onClose={onClose} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  block: { paddingVertical: 8, gap: 10 },
  blockTitle: { fontSize: 15, fontFamily: fonts.bold, color: colors.text },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 36 },
  rowLabel: { fontSize: 14, fontFamily: fonts.medium, color: colors.textSecondary },
  stars: { flexDirection: "row", gap: 4 },
  comment: { fontSize: 13.5, fontFamily: fonts.regular, fontStyle: "italic", color: colors.textSecondary },
  input: { minHeight: 72, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, fontSize: 14, fontFamily: fonts.regular, color: colors.text, textAlignVertical: "top" },
  productName: { flex: 1, fontSize: 14, fontFamily: fonts.medium, color: colors.text },
  reviewBtn: { borderWidth: 1, borderColor: colors.primary, borderRadius: 16, paddingHorizontal: 14, minHeight: 32, justifyContent: "center" },
  reviewText: { fontSize: 13, fontFamily: fonts.bold, color: colors.primary },
  submit: { backgroundColor: colors.primary, borderRadius: 24, minHeight: 48, alignItems: "center", justifyContent: "center" },
  submitText: { fontSize: 15, fontFamily: fonts.bold, color: "#fff" },
});
