import { useCallback, useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { can } from "@martly/shared/permissions";
import { api } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";
import { useResource } from "../../../lib/manage/use-resource";
import { useRefreshOnFocus } from "../../../lib/manage/use-refresh-on-focus";
import { useAction } from "../../../lib/manage/use-action";
import { ManageStackScreen } from "../../../components/manage/ManageStackScreen";
import { Button } from "../../../components/manage/ui/Button";
import { ConfirmDialog } from "../../../components/manage/ui/ConfirmDialog";
import { AccessGate } from "../../../components/manage/support/AccessGate";
import { WalletSheet } from "../../../components/manage/customers/WalletSheet";
import {
  AddressesCard,
  OrdersCard,
  ProfileCard,
  SubscriptionsCard,
  WalletCard,
} from "../../../components/manage/customers/CustomerSections";
import type {
  CustomerDetail,
  CustomerOrder,
  CustomerSubscription,
  WalletData,
} from "../../../components/manage/customers/types";

function useCustomerExtras(id: string) {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [subscriptions, setSubscriptions] = useState<CustomerSubscription[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const [w, o, s] = await Promise.all([
        api.get<WalletData>(`/api/v1/wallet/admin/${id}`),
        api.getList<CustomerOrder>(`/api/v1/orders?userId=${id}&pageSize=5`),
        api.getList<CustomerSubscription>(`/api/v1/subscriptions/admin?userId=${id}&pageSize=20`),
      ]);
      setWallet(w.data);
      setOrders(o.data);
      setSubscriptions(s.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load customer activity");
    }
  }, [id]);

  useRefreshOnFocus(reload);
  useEffect(() => {
    reload();
  }, [reload]);

  return { wallet, orders, subscriptions, error, reload };
}

function CustomerDetailScreen({ id }: { id: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const { data, loading, error, reload } = useResource<CustomerDetail>(`/api/v1/users/${id}`);
  const extras = useCustomerExtras(id);
  const { run, running } = useAction();
  const [walletOpen, setWalletOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const canDelete = !!user && can(user, "customers", "delete");

  const remove = async () => {
    const done = await run(() => api.delete(`/api/v1/users/${id}`), "Customer deleted");
    if (!done) return;
    setConfirmDelete(false);
    router.back();
  };

  return (
    <ManageStackScreen
      title={data?.name ?? "Customer"}
      loading={loading}
      error={error ?? extras.error}
      onRetry={() => { reload(); extras.reload(); }}
      actions={canDelete ? <Button label="Delete customer" icon="trash-outline" variant="danger" onPress={() => setConfirmDelete(true)} style={{ flex: 1 }} /> : undefined}
    >
      {data && (
        <>
          <ProfileCard customer={data} />
          <WalletCard wallet={extras.wallet} onAdjust={() => setWalletOpen(true)} />
          <OrdersCard orders={extras.orders} />
          <SubscriptionsCard subscriptions={extras.subscriptions} />
          <AddressesCard customer={data} />
          <WalletSheet
            visible={walletOpen}
            customerId={id}
            balance={extras.wallet?.balance ?? 0}
            onClose={() => setWalletOpen(false)}
            onDone={extras.reload}
          />
          <ConfirmDialog
            visible={confirmDelete}
            title="Delete customer?"
            message={`This permanently removes ${data.name}, their ${data._count.orders} order(s), ${data._count.reviews} review(s), addresses and wallet. It can't be undone.`}
            confirmLabel="Delete permanently"
            running={running}
            onConfirm={remove}
            onClose={() => setConfirmDelete(false)}
          />
        </>
      )}
    </ManageStackScreen>
  );
}

export default function CustomerDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AccessGate resource="customers"><CustomerDetailScreen id={id} /></AccessGate>;
}
