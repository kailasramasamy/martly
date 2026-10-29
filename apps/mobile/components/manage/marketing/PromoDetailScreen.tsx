import { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import type { PromoDetail } from "@martly/shared/types";
import { ManageStackScreen } from "../ManageStackScreen";
import { SectionCard } from "../ui/SectionCard";
import { StatusPill } from "../ui/StatusPill";
import { Button } from "../ui/Button";
import { api } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";
import { useAction } from "../../../lib/manage/use-action";
import { useResource } from "../../../lib/manage/use-resource";
import { colors, fonts } from "../../../constants/theme";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { PROMO_KIND, PROMO_STATUS, discountLabel } from "./promo-utils";
import { ManualSummary, PromoResultsCard, RedraftCard } from "./PromoExtras";
import { PromoBannerCard } from "./PromoBannerCard";
import { WordingAndPush, DraftingProgress, Performance, PromoProducts } from "./PromoSections";

const POLL_MS = 2000;
const PREVIEW_STATUSES = ["READY", "LIVE", "ENDED"];
const ACTIONABLE = ["READY", "LIVE", "ENDED", "FAILED"];

type Pending = "launch" | "delete" | "end" | "reopen" | null;

const CONFIRM: Record<Exclude<Pending, null>, { title: string; label: string; primary: boolean; done: string }> = {
  launch: { title: "Launch this promo?", label: "Launch", primary: true, done: "Promo is live" },
  delete: { title: "Delete this promotion?", label: "Delete", primary: false, done: "Promotion deleted" },
  end: { title: "End this promo now?", label: "End now", primary: false, done: "Promo ended" },
  reopen: { title: "Use this promo again?", label: "Use again", primary: true, done: "Ready to launch again" },
};

function confirmMessage(kind: Exclude<Pending, null>, promo: PromoDetail): string {
  if (kind === "launch") {
    const discount = promo.discountType ? `${discountLabel(promo.discountType, promo.discountValue)} on ${promo.products.length} products` : "No discount";
    return `${discount}. ${promo.notify ? "A push goes to customers." : "No push."}`;
  }
  if (kind === "end") return "Removes the banner and restores prices.";
  if (kind === "reopen") return "It goes back to Ready with the same banner and products; launch it for a fresh window.";
  return promo.status === "LIVE" ? "It ends now (prices go back), then it is removed." : "Its banner and results are removed.";
}

function usePromoActions(id: string, promo: PromoDetail | null, setData: (p: PromoDetail) => void) {
  const router = useRouter();
  const { run, running } = useAction();
  const [pending, setPending] = useState<Pending>(null);

  const perform = async (kind: Exclude<Pending, null>) => {
    const call = () => (kind === "delete" ? api.delete(`/api/v1/promos/${id}`) : api.post<PromoDetail>(`/api/v1/promos/${id}/${kind}`, undefined));
    const res = await run(call, CONFIRM[kind].done);
    setPending(null);
    if (!res) return;
    if (kind === "delete") router.back();
    else setData(res.data as PromoDetail);
  };

  const removeProduct = async (productId: string) => {
    if (!promo) return;
    const keep = promo.products.map((p) => p.productId).filter((p) => p !== productId);
    const res = await run(() => api.patch<PromoDetail>(`/api/v1/promos/${id}/items`, { productIds: keep }), "Product removed");
    if (res) setData(res.data);
  };

  const redraft = async () => {
    const res = await run(() => api.post<PromoDetail>(`/api/v1/promos/${id}/regenerate`, undefined), "Drafting again");
    if (res) setData(res.data);
  };

  const retry = async () => {
    if (!promo) return;
    const res = await run(() => api.post<{ id: string }>("/api/v1/promos", { brief: promo.brief, autoLaunch: promo.autoLaunch, notify: promo.notify }), "Drafting again");
    if (res) router.replace(`/manage/promos/${res.data.id}`);
  };

  return { pending, setPending, perform, removeProduct, redraft, retry, running };
}

interface BodyProps {
  promo: PromoDetail;
  busy: boolean;
  onRemove: (productId: string) => void;
  onRedraft: () => void;
  onChange: (promo: PromoDetail) => void;
}

function PromoBody({ promo, busy, onRemove, onRedraft, onChange }: BodyProps) {
  const isAi = promo.kind === "AI";
  const isSuper = useAuth().user?.role === "SUPER_ADMIN";
  return (
    <>
      <View style={styles.head}>
        <View style={styles.pills}>
          <StatusPill {...PROMO_STATUS[promo.status]} dot={promo.status === "LIVE"} />
          <StatusPill {...PROMO_KIND[promo.kind]} />
        </View>
        <Text style={styles.brief}>{promo.brief}</Text>
      </View>
      {promo.status === "FAILED" ? <SectionCard title="Drafting failed"><Text style={styles.error}>{promo.failureReason ?? "Unknown error"}</Text></SectionCard> : null}
      {promo.status === "DRAFTING" ? <DraftingProgress log={promo.log} /> : null}
      {PREVIEW_STATUSES.includes(promo.status) ? (
        <>
          {isAi ? <WordingAndPush promo={promo} /> : <ManualSummary promo={promo} />}
          <PromoBannerCard promo={promo} onChange={onChange} />
          {isSuper && isAi && promo.status === "READY" && promo.redraftsLeft > 0 ? <RedraftCard left={promo.redraftsLeft} busy={busy} onRedraft={onRedraft} /> : null}
          {promo.status === "LIVE" || promo.status === "ENDED" ? <PromoResultsCard promo={promo} /> : null}
          <Performance promo={promo} />
          {promo.assumptions.length > 0 ? <SectionCard title="Assumptions">{promo.assumptions.map((a) => <Text key={a} style={styles.assumption}>{`\u2022 ${a}`}</Text>)}</SectionCard> : null}
          <PromoProducts promo={promo} busy={busy} onRemove={onRemove} />
        </>
      ) : null}
    </>
  );
}

export function PromoDetailScreen({ id }: { id: string }) {
  const { data: promo, setData, loading, error, reload } = useResource<PromoDetail>(`/api/v1/promos/${id}`);
  const a = usePromoActions(id, promo, setData);
  const drafting = promo?.status === "DRAFTING";
  const { pending } = a;

  useEffect(() => {
    if (!drafting) return;
    const timer = setInterval(reload, POLL_MS);
    return () => clearInterval(timer);
  }, [drafting, reload]);

  const actions = promo && ACTIONABLE.includes(promo.status) ? <PromoActions promo={promo} running={a.running} onPending={a.setPending} onRetry={a.retry} /> : undefined;
  return (
    <ManageStackScreen title={promo?.title ?? promo?.brief ?? "Promotion"} loading={loading} error={error} onRetry={reload} onRefresh={reload} actions={actions}>
      {promo ? <PromoBody promo={promo} busy={a.running} onRemove={a.removeProduct} onRedraft={a.redraft} onChange={setData} /> : null}
      {promo && pending ? (
        <ConfirmDialog visible title={CONFIRM[pending].title} message={confirmMessage(pending, promo)} confirmLabel={CONFIRM[pending].label} confirmVariant={CONFIRM[pending].primary ? "primary" : "danger"} running={a.running} onConfirm={() => a.perform(pending)} onClose={() => a.setPending(null)} />
      ) : null}
    </ManageStackScreen>
  );
}

interface ActionsProps {
  promo: PromoDetail;
  running: boolean;
  onPending: (kind: Pending) => void;
  onRetry: () => void;
}

function PromoActions({ promo, running, onPending, onRetry }: ActionsProps) {
  const flex = styles.flex;
  // Brand promotions end with their campaign; everything else can be deleted (a live one is ended first)
  const remove = promo.chargedFrom === "BRAND" ? null : <Button label="Delete" variant="danger" onPress={() => onPending("delete")} style={flex} />;
  if (promo.status === "READY") {
    return (
      <>
        {remove}
        <Button label="Launch" icon="rocket-outline" onPress={() => onPending("launch")} style={flex} />
      </>
    );
  }
  if (promo.status === "LIVE") {
    return (
      <>
        {remove}
        <Button label="End now" variant="danger" onPress={() => onPending("end")} style={flex} />
      </>
    );
  }
  if (promo.status === "ENDED") {
    return (
      <>
        {remove}
        <Button label="Use again" onPress={() => onPending("reopen")} style={flex} />
      </>
    );
  }
  if (promo.status === "FAILED") {
    return (
      <>
        {remove}
        {promo.kind === "AI" ? <Button label="Try again" onPress={onRetry} loading={running} style={flex} /> : null}
      </>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  head: { gap: 8 },
  pills: { flexDirection: "row", gap: 6 },
  brief: { fontFamily: fonts.medium, fontSize: 14.5, color: colors.textSecondary, lineHeight: 20 },
  error: { fontFamily: fonts.medium, fontSize: 14, color: colors.error },
  assumption: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.text, marginBottom: 4 },
  flex: { flex: 1 },
});
