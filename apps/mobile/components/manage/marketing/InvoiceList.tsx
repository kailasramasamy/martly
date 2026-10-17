import { Linking } from "react-native";
import { ManageStackScreen } from "../ManageStackScreen";
import { SectionCard } from "../ui/SectionCard";
import { ListRow } from "../ui/ListRow";
import { EmptyState } from "../ui/EmptyState";
import { formatDate } from "../ui/dates";
import { formatINR } from "../ui/tokens";
import { getApiUrl } from "../../../lib/api";
import { useResource } from "../../../lib/manage/use-resource";
import { useToast } from "../../../lib/toast-context";
import type { AdOrder } from "./plan-types";

export function InvoiceList() {
  const toast = useToast();
  const { data, loading, error, reload } = useResource<AdOrder[]>("/api/v1/marketing/orders");
  const paid = (data ?? []).filter((o) => o.invoiceUrl);

  // Invoice links expire after 15 minutes, so each tap uses the link from the latest load
  const open = (order: AdOrder) => {
    Linking.openURL(`${getApiUrl()}${order.invoiceUrl}`).catch(() => toast.show("Couldn't open the invoice", "error"));
  };

  return (
    <ManageStackScreen title="Invoices" loading={loading} error={error} onRetry={reload} onRefresh={reload}>
      {paid.length === 0 ? (
        <EmptyState icon="receipt-outline" title="No invoices yet" message="Invoices appear here after you buy a plan or extra promotions." />
      ) : (
        <SectionCard flush>
          {paid.map((o) => (
            <ListRow
              key={o.id}
              title={o.quantity > 1 ? `${o.product.name} x ${o.quantity}` : o.product.name}
              subtitle={o.number ?? undefined}
              caption={o.paidAt ? formatDate(o.paidAt) : undefined}
              value={formatINR(o.total, { decimals: true })}
              icon="receipt-outline"
              chevron
              onPress={() => open(o)}
            />
          ))}
        </SectionCard>
      )}
    </ManageStackScreen>
  );
}
