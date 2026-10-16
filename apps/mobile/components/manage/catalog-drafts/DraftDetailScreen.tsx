import { useState, type ReactNode } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { CatalogDraftDetail } from "@martly/shared/types";
import { colors, fonts, radius } from "../../../constants/theme";
import { useResource } from "../../../lib/manage/use-resource";
import { ManageStackScreen } from "../ManageStackScreen";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { SectionCard } from "../ui/SectionCard";
import { StatusPill } from "../ui/StatusPill";
import { formatINR, manage } from "../ui/tokens";
import { DraftShots } from "./DraftShots";
import { CostLine, DraftFacts, DraftPicks } from "./DraftFacts";
import { DraftReviewForm } from "./DraftReviewForm";
import { useReviewForm } from "./use-review-form";
import { useDraftActions } from "./use-draft-actions";
import { DRAFT_STATUS } from "./status";

interface DraftProps {
  draft: CatalogDraftDetail;
  onDone: (next: CatalogDraftDetail) => void;
}

function StatusCard({ draft }: { draft: CatalogDraftDetail }) {
  const cfg = DRAFT_STATUS[draft.status];
  const reasons = draft.status === "NEEDS_REVIEW" ? draft.reviewReasons : [];
  return (
    <SectionCard>
      <View style={styles.statusRow}>
        <StatusPill label={cfg.label} color={cfg.color} bg={cfg.bg} />
        <Text style={styles.price}>{formatINR(draft.sellingPrice)} <Text style={styles.mrp}>MRP {formatINR(draft.mrp)}</Text></Text>
      </View>
      {reasons.length > 0 && (
        <View style={styles.reasons}>
          {reasons.map((r) => (
            <View key={r} style={styles.reason}>
              <Ionicons name="alert-circle" size={16} color={manage.attentionText} />
              <Text style={styles.reasonText}>{r}</Text>
            </View>
          ))}
        </View>
      )}
      {draft.error ? <Text style={styles.error}>{draft.error}</Text> : null}
      {draft.matchedExisting ? <Text style={styles.note}>This product was already in the catalog and has been listed for the store.</Text> : null}
    </SectionCard>
  );
}

function Details({ draft, children }: { draft: CatalogDraftDetail; children?: ReactNode }) {
  return (
    <>
      <StatusCard draft={draft} />
      {children}
      <DraftPicks draft={draft} />
      <DraftShots shots={draft.shots} />
      <DraftFacts draft={draft} />
      <CostLine usd={draft.costUsd} />
    </>
  );
}

function DiscardDialog({ visible, running, onConfirm, onClose }: { visible: boolean; running: boolean; onConfirm: () => void; onClose: () => void }) {
  return (
    <ConfirmDialog
      visible={visible}
      title="Discard this product?"
      message="It won't be added to the store. You can photograph it again any time."
      confirmLabel="Discard"
      running={running}
      onConfirm={onConfirm}
      onClose={onClose}
    />
  );
}

function ReviewScreen({ draft, onDone }: DraftProps) {
  const form = useReviewForm(draft, onDone);
  const { discard, running } = useDraftActions(draft.id, onDone);
  const [confirming, setConfirming] = useState(false);
  return (
    <ManageStackScreen
      title={draft.name ?? "Review product"}
      actions={
        <>
          <Button label="Discard" variant="danger" onPress={() => setConfirming(true)} disabled={form.approving} />
          <Button label="Approve & publish" icon="checkmark" onPress={form.approve} loading={form.approving} style={styles.grow} />
        </>
      }
    >
      <Details draft={draft}>
        <DraftReviewForm draft={draft} values={form.values} tree={form.tree} onChange={form.patch} />
      </Details>
      <DiscardDialog visible={confirming} running={running} onConfirm={discard} onClose={() => setConfirming(false)} />
    </ManageStackScreen>
  );
}

function ProductLink({ productId }: { productId: string }) {
  const router = useRouter();
  return (
    <SectionCard>
      <Button label="View product" icon="cube-outline" variant="secondary" onPress={() => router.push(`/manage/products/${productId}`)} />
    </SectionCard>
  );
}

function StatusActions({ draft, onDone }: DraftProps) {
  const { retry, discard, running } = useDraftActions(draft.id, onDone);
  const [confirming, setConfirming] = useState(false);
  const canDiscard = draft.status === "QUEUED" || draft.status === "FAILED";
  if (!canDiscard) return null;
  return (
    <>
      {draft.status === "FAILED" && <Button label="Retry" icon="refresh" onPress={retry} loading={running} style={styles.grow} />}
      <Button label="Discard" variant="danger" onPress={() => setConfirming(true)} disabled={running} style={draft.status === "QUEUED" ? styles.grow : undefined} />
      <DiscardDialog visible={confirming} running={running} onConfirm={discard} onClose={() => setConfirming(false)} />
    </>
  );
}

function ReadOnlyScreen({ draft, onDone, onRefresh }: DraftProps & { onRefresh: () => void }) {
  const actions = draft.status === "QUEUED" || draft.status === "FAILED" ? <StatusActions draft={draft} onDone={onDone} /> : undefined;
  return (
    <ManageStackScreen title={draft.name ?? "Product"} actions={actions} refreshing={false} onRefresh={onRefresh}>
      <Details draft={draft}>
        {draft.productId && (draft.status === "PUBLISHED" || draft.status === "DUPLICATE") ? <ProductLink productId={draft.productId} /> : null}
      </Details>
    </ManageStackScreen>
  );
}

export function DraftDetailScreen({ id }: { id: string }) {
  const { data, setData, loading, error, reload } = useResource<CatalogDraftDetail>(`/api/v1/catalog-drafts/${id}`);
  if (!data) return <ManageStackScreen title="Product" loading={loading} error={error} onRetry={reload}>{null}</ManageStackScreen>;
  if (data.status === "NEEDS_REVIEW") return <ReviewScreen draft={data} onDone={setData} />;
  return <ReadOnlyScreen draft={data} onDone={setData} onRefresh={reload} />;
}

const styles = StyleSheet.create({
  statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  price: { fontFamily: fonts.extrabold, fontSize: 17, color: colors.text },
  mrp: { fontFamily: fonts.medium, fontSize: 12, color: manage.muted },
  reasons: { marginTop: 10, gap: 6 },
  reason: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 10, borderRadius: radius.md, backgroundColor: manage.attentionBg },
  reasonText: { flex: 1, fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18, color: manage.attentionText },
  error: { marginTop: 10, fontFamily: fonts.medium, fontSize: 13, color: colors.error },
  note: { marginTop: 10, fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
  grow: { flex: 1 },
});
