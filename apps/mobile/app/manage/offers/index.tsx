import { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { can } from "@martly/shared/permissions";
import type { StoreOffer, StoreOfferStatus } from "@martly/shared/types";
import { api } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";
import { useAction } from "../../../lib/manage/use-action";
import { usePagedList } from "../../../lib/manage/use-paged-list";
import { ManageListScreen } from "../../../components/manage/ManageListScreen";
import { HeaderAction } from "../../../components/manage/HeaderAction";
import { useStoreScope } from "../../../components/manage/StoreScope";
import { ConfirmDialog } from "../../../components/manage/ui/ConfirmDialog";
import { EmptyState } from "../../../components/manage/ui/EmptyState";
import { ListRow } from "../../../components/manage/ui/ListRow";
import { SegmentedTabs } from "../../../components/manage/ui/SegmentedTabs";
import { OFFER_TABS, offerDates, offerText } from "../../../components/manage/offers/describe";

/** Buy X get Y and discounts running at a store; tap one to edit its listing, long-press to end it */
export default function OffersScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { storeId, picker } = useStoreScope({ required: true, placeholder: "Pick a store" });
  const [status, setStatus] = useState<StoreOfferStatus>("live");
  const [q, setQ] = useState("");
  const [ending, setEnding] = useState<StoreOffer | null>(null);
  const { run, running } = useAction();
  const params = useMemo(() => ({ storeId: storeId ?? "", status, q }), [storeId, status, q]);
  const list = usePagedList<StoreOffer>("/api/v1/offers", params, { enabled: !!storeId });
  if (!can(user, "offers", "list")) return <EmptyState icon="lock-closed-outline" title="No access" message="Your role can't change prices or offers." />;

  const end = async () => {
    if (!ending || !storeId) return;
    const body = { kind: ending.kind, storeId, storeProductIds: [ending.storeProductId] };
    const ok = await run(() => api.post("/api/v1/offers/end", body), "Offer ended");
    setEnding(null);
    if (ok) void list.refresh();
  };

  return (
    <>
      <ManageListScreen
        title="Offers"
        list={list}
        search={storeId ? { value: q, onChange: setQ, placeholder: "Search products" } : undefined}
        filters={<>{picker}<SegmentedTabs options={OFFER_TABS} value={status} onChange={setStatus} /></>}
        headerRight={storeId ? () => <HeaderAction onPress={() => router.push({ pathname: "/manage/offers/new", params: { storeId } })} accessibilityLabel="New offer" /> : undefined}
        empty={{ icon: "flash-outline", title: "No offers here", message: "Use + to put Buy X get Y or a discount on products." }}
        renderItem={(o) => (
          <ListRow
            title={`${o.productName} · ${o.variantName}`}
            subtitle={offerText(o)}
            caption={status === "ended" ? offerDates(o) : `${offerDates(o)} · long-press to end`}
            imageUrl={o.imageUrl}
            chevron
            onPress={() => router.push(`/manage/store-products/${o.storeProductId}`)}
            onLongPress={() => setEnding(o)}
          />
        )}
      />
      <ConfirmDialog
        visible={ending !== null}
        title="End this offer?"
        message={ending ? `${offerText(ending)} on ${ending.productName} ${ending.variantName} stops now.` : ""}
        confirmLabel="End offer"
        running={running}
        onConfirm={end}
        onClose={() => setEnding(null)}
      />
    </>
  );
}
