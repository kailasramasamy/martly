import { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { colors, fonts } from "../../../constants/theme";
import { useManageScope } from "../../../lib/manage-scope-context";
import { usePagedList } from "../../../lib/manage/use-paged-list";
import { ManageListScreen } from "../ManageListScreen";
import { HeaderAction } from "../HeaderAction";
import { ListRow } from "../ui/ListRow";
import { Button } from "../ui/Button";
import { SegmentedTabs } from "../ui/SegmentedTabs";
import { StatusPill } from "../ui/StatusPill";
import { formatINR, manage } from "../ui/tokens";
import type { CatalogDraftSummary } from "@martly/shared/types";
import { DRAFT_STATUS, FILTER_STATUSES, isInFlight, type DraftStatus } from "./status";

const POLL_MS = 5000;

const FILTER_OPTIONS = [
  { value: "ALL" as const, label: "All" },
  ...FILTER_STATUSES.map((s) => ({ value: s, label: DRAFT_STATUS[s].label })),
];

function rowTitle(d: CatalogDraftSummary): string {
  return d.name ?? (isInFlight(d.status) ? "Reading label…" : "Unnamed product");
}

function rowCaption(d: CatalogDraftSummary): string | undefined {
  if (d.status === "NEEDS_REVIEW") return d.reviewReasons[0];
  if (d.status === "FAILED") return d.error ?? undefined;
  return undefined;
}

function DraftRow({ draft, onPress }: { draft: CatalogDraftSummary; onPress: () => void }) {
  const cfg = DRAFT_STATUS[draft.status];
  return (
    <ListRow
      title={rowTitle(draft)}
      subtitle={draft.variantName ?? undefined}
      caption={rowCaption(draft)}
      imageUrl={draft.thumbnailUrl}
      railColor={cfg.color}
      value={formatINR(draft.sellingPrice)}
      trailing={<StatusPill label={cfg.label} color={cfg.color} bg={cfg.bg} dot={isInFlight(draft.status)} />}
      onPress={onPress}
    />
  );
}

export function DraftQueueScreen() {
  const router = useRouter();
  const { storeId } = useManageScope();
  const [status, setStatus] = useState<DraftStatus | "ALL">("ALL");
  const list = usePagedList<CatalogDraftSummary>("/api/v1/catalog-drafts", {
    ...(storeId ? { storeId } : {}),
    ...(status !== "ALL" ? { status } : {}),
  });
  const { reload } = list;
  const polling = list.items.some((d) => isInFlight(d.status));

  useEffect(() => {
    if (!polling) return;
    const timer = setInterval(reload, POLL_MS);
    return () => clearInterval(timer);
  }, [polling, reload]);

  const addProduct = () => router.push("/manage/add-product");

  return (
    <ManageListScreen
      title="Add products"
      list={list}
      headerRight={() => <HeaderAction icon="camera-outline" label="Add" onPress={addProduct} />}
      filters={<SegmentedTabs options={FILTER_OPTIONS} value={status} onChange={setStatus} />}
      renderItem={(d) => <DraftRow draft={d} onPress={() => router.push(`/manage/catalog-drafts/${d.id}`)} />}
      empty={{ icon: "camera-outline", title: "Nothing here yet", message: "Photograph a product and the catalog agent does the rest." }}
      footer={
        <View style={styles.footer}>
          <Text style={styles.hint}>{polling ? "Updating automatically…" : "Snap the pack, enter prices, move on."}</Text>
          <Button label="Add product" icon="camera" onPress={addProduct} />
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  footer: { padding: 12, paddingBottom: 16, gap: 8, backgroundColor: manage.card, borderTopWidth: 1, borderTopColor: manage.line },
  hint: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, textAlign: "center" },
});
