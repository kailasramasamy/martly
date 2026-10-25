import { useState } from "react";
import { View, KeyboardAvoidingView, Platform, StyleSheet, type FlatList } from "react-native";
import { Loader } from "../../Loader";
import { Stack, useRouter } from "expo-router";
import { colors } from "../../../constants/theme";
import { useKeyboardReveal } from "../../../lib/use-keyboard-reveal";
import { manage } from "../ui/tokens";
import { EmptyState } from "../ui/EmptyState";
import { StickyActionBar } from "../ui/StickyActionBar";
import { CountDetailList } from "./CountDetailList";
import { CountActions } from "./CountActions";
import { CountLineSheet } from "./CountLineSheet";
import { RecountSheet } from "./RecountSheet";
import { CountReviewDialogs, type CountDialog } from "./CountReviewDialogs";
import { useCountDetail } from "./use-count-detail";
import { useCountReview } from "./use-count-review";
import { useStockAccess } from "./use-stock-access";
import type { StockCountDetail } from "./types";

/** Count detail: blind entry while DRAFT or RECOUNT, read-only review (with recount and correction for approvers) once submitted */
export function CountDetailScreen({ id }: { id: string }) {
  const c = useCountDetail(id);
  if (c.loading) return <Loader style={styles.loading} size="large" />;
  if (c.error || !c.data) return <EmptyState icon="cloud-offline-outline" title="Couldn't load" message={c.error ?? "Count not found"} action={{ label: "Try again", onPress: c.reload }} />;
  return <CountDetailBody c={c} count={c.data} />;
}

function CountDetailBody({ c, count }: { c: ReturnType<typeof useCountDetail>; count: StockCountDetail }) {
  const router = useRouter();
  const access = useStockAccess();
  const keyboard = useKeyboardReveal<FlatList>();
  const review = useCountReview(c, count);
  const [dialog, setDialog] = useState<CountDialog>(null);
  // Recount is blind: only a counter who can't see system stock gets the flagged-lines-only entry screen
  const editing = access.canCount && (count.status === "DRAFT" || (count.status === "RECOUNT" && !count.canSeeSystemStock));
  const reviewing = count.status === "SUBMITTED" && access.canApprove;
  const recounting = count.status === "RECOUNT";

  const finish = async (ok: unknown) => {
    setDialog(null);
    if (ok && count.status === "DRAFT") router.back();
  };
  const decide = async (action: "approve" | "reject", note: string) => {
    if (action === "reject" && !note.trim()) return;
    if (await c.review(action, note)) setDialog(null);
  };

  return (
    <View ref={keyboard.rootRef} onLayout={keyboard.onRootLayout} style={{ flex: 1 }}>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={keyboard.topOffset}>
      <Stack.Screen options={{ title: count.subcategory.name }} />
      <CountDetailList count={count} c={c} review={review} editing={editing} listRef={keyboard.scrollRef} onScroll={keyboard.onScroll} />
      {(editing || reviewing) && (
        <StickyActionBar>
          <CountActions status={count.status} canApprove={access.canApprove} editing={editing} running={c.running}
            selectedCount={review.selected ? review.selected.size : null}
            onSave={c.save} onSubmit={() => setDialog("submit")} onDiscard={() => setDialog("discard")}
            onApprove={() => setDialog("approve")} onReject={() => setDialog("reject")}
            onStartRecount={review.startSelecting} onCancelRecount={review.cancelSelecting} onSendRecount={review.openRecount} />
        </StickyActionBar>
      )}
      <CountReviewDialogs dialog={dialog} running={c.running} recount={recounting}
        counted={count.items.filter((i) => c.valueFor(i.storeProductId, i.countedQty) !== "").length} total={count.items.length}
        onClose={() => setDialog(null)} onSubmit={async () => finish(await c.submit())} onDiscard={async () => finish(await c.discard())} onReview={decide} />
      <RecountSheet visible={review.recountOpen} selectedCount={review.selected?.size ?? 0} restCount={review.restCount}
        running={c.running} onClose={review.closeRecount} onConfirm={review.send} />
      <CountLineSheet item={review.line} canCorrect={reviewing && !review.line?.applied} running={c.running}
        onClose={review.closeLine} onCorrect={review.correct} />
    </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: manage.canvas },
  loading: { marginTop: 80 },
});
