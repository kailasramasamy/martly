import { can } from "@martly/shared/permissions";
import { useAuth } from "../../../lib/auth-context";
import { useResource } from "../../../lib/manage/use-resource";
import { ExpressForm } from "../../../components/manage/delivery-config/ExpressForm";
import { ScreenNotice } from "../../../components/manage/delivery-config/ScreenNotice";
import { useStoreScope } from "../../../components/manage/StoreScope";
import type { ExpressConfig } from "../../../components/manage/delivery-config/types";

export default function ExpressDeliveryScreen() {
  const { user } = useAuth();
  const { storeId, picker, hasStores } = useStoreScope({ defaultFirst: true });
  const config = useResource<ExpressConfig | null>(storeId ? `/api/v1/express-delivery/config?storeId=${storeId}` : null);

  if (!can(user?.role ?? "", "express-delivery", "edit")) return <ScreenNotice title="Express delivery" kind="denied" />;
  if (!storeId || !hasStores) return <ScreenNotice title="Express delivery" kind="no-store" />;
  return (
    <ExpressForm
      key={`${storeId}:${config.loading}`}
      storeId={storeId}
      storeField={picker}
      config={config.data}
      loading={config.loading}
      error={config.error}
      onReload={config.reload}
    />
  );
}
