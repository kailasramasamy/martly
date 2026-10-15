import { useState } from "react";
import { useRouter } from "expo-router";
import { usePagedList } from "../../../lib/manage/use-paged-list";
import { ManageListScreen } from "../../../components/manage/ManageListScreen";
import { ListRow } from "../../../components/manage/ui/ListRow";
import { formatDate } from "../../../components/manage/ui/dates";
import { AccessGate } from "../../../components/manage/support/AccessGate";
import type { CustomerSummary } from "../../../components/manage/customers/types";

function CustomerList() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const list = usePagedList<CustomerSummary>("/api/v1/users", { role: "CUSTOMER", q });

  return (
    <ManageListScreen
      title="Customers"
      list={list}
      search={{ value: q, onChange: setQ, placeholder: "Search name or email" }}
      empty={{ icon: "people-outline", title: "No customers found", message: q ? "Try a different search." : "Customers appear after their first order." }}
      renderItem={(c) => {
        const orders = c._count?.orders ?? 0;
        return (
          <ListRow
            icon="person-outline"
            title={c.name}
            subtitle={c.phone ?? c.email}
            caption={`Joined ${formatDate(c.createdAt)}`}
            value={`${orders} ${orders === 1 ? "order" : "orders"}`}
            chevron
            onPress={() => router.push(`/manage/customers/${c.id}`)}
          />
        );
      }}
    />
  );
}

export default function CustomersScreen() {
  return <AccessGate resource="customers"><CustomerList /></AccessGate>;
}
