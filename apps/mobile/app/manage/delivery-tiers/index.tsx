import { Switch } from "react-native";
import { useRouter } from "expo-router";
import { can } from "@martly/shared/permissions";
import { colors } from "../../../constants/theme";
import { api } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";
import { useAction } from "../../../lib/manage/use-action";
import { usePagedList } from "../../../lib/manage/use-paged-list";
import { ManageListScreen } from "../../../components/manage/ManageListScreen";
import { HeaderAction } from "../../../components/manage/HeaderAction";
import { ListRow } from "../../../components/manage/ui/ListRow";
import { manage, formatINR } from "../../../components/manage/ui/tokens";
import { ScreenNotice } from "../../../components/manage/delivery-config/ScreenNotice";
import { useStoreScope } from "../../../components/manage/StoreScope";
import type { DeliveryTier } from "../../../components/manage/delivery-config/types";

export default function DeliveryTiersScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { run } = useAction();
  const { storeId, picker, hasStores } = useStoreScope({ defaultFirst: true });
  const allowed = can(user, "delivery-tiers", "list");
  const list = usePagedList<DeliveryTier>("/api/v1/delivery-tiers", { storeId }, { pageSize: 50, enabled: !!storeId && allowed });

  const toggle = async (tier: DeliveryTier, isActive: boolean) => {
    const saved = await run(() => api.put(`/api/v1/delivery-tiers/${tier.id}`, { isActive }));
    if (saved) list.updateItem(tier.id, { isActive });
  };

  if (!allowed) return <ScreenNotice title="Delivery charges" kind="denied" />;
  if (!hasStores) return <ScreenNotice title="Delivery charges" kind="no-store" />;
  const addTier = () => router.push(`/manage/delivery-tiers/new?storeId=${storeId}`);
  return (
    <ManageListScreen
      title="Delivery charges"
      list={list}
      filters={
        <>
          {picker}
          {storeId && (
            <ListRow
              title="Radius, free delivery & minimum order"
              subtitle="Fees below go by distance from the store"
              chevron
              onPress={() => router.push(`/manage/delivery-tiers/settings?storeId=${storeId}`)}
            />
          )}
        </>
      }
      headerRight={can(user, "delivery-tiers", "create") && storeId ? () => <HeaderAction accessibilityLabel="Add tier" onPress={addTier} /> : undefined}
      empty={{ icon: "navigate-outline", title: "No delivery tiers", message: "Add distance bands so customers can be charged for delivery." }}
      renderItem={(tier) => (
        <ListRow
          title={`${tier.minDistance} – ${tier.maxDistance} km`}
          subtitle={`${Number(tier.deliveryFee) === 0 ? "Free" : formatINR(tier.deliveryFee)} · ${tier.estimatedMinutes} min`}
          railColor={tier.isActive ? colors.primary : manage.muted}
          trailing={<Switch value={tier.isActive} disabled={!can(user, "delivery-tiers", "edit")} onValueChange={(v) => toggle(tier, v)} trackColor={{ true: colors.primary, false: manage.line }} />}
          onPress={() => router.push(`/manage/delivery-tiers/${tier.id}`)}
        />
      )}
    />
  );
}
