import { useRouter } from "expo-router";
import { useManageScope } from "../../../lib/manage-scope-context";
import { offerLabel } from "../inventory/draft";
import { ListRow } from "../ui/ListRow";
import { SectionCard } from "../ui/SectionCard";
import { formatINR } from "../ui/tokens";
import { useStoreMappings } from "./use-store-mappings";
import type { StoreMapping } from "./types";

function describe(m: StoreMapping) {
  const offer = m.offerBuyQty && m.offerGetQty ? ` · ${offerLabel({ buy: m.offerBuyQty, get: m.offerGetQty })}` : "";
  const hidden = m.isActive ? "" : " · Hidden";
  return `${formatINR(Number(m.price), { decimals: true })} · ${m.stock - m.reservedStock} in stock${offer}${hidden}`;
}

/** This product's sizes at the store being managed, each opening its listing for price, stock and offers */
export function StoreListingsCard({ productId }: { productId: string }) {
  const router = useRouter();
  const { storeId } = useManageScope();
  const { mappings } = useStoreMappings(productId);
  const rows = storeId ? mappings.filter((m) => m.storeId === storeId) : mappings;
  if (rows.length === 0) return null;

  return (
    <SectionCard title="Price, stock & offers" flush>
      {rows.map((m) => (
        <ListRow
          key={m.id}
          title={storeId ? m.variant.name : `${m.variant.name} · ${m.store.name}`}
          subtitle={describe(m)}
          icon="pricetag-outline"
          chevron
          onPress={() => router.push(`/manage/store-products/${m.id}`)}
        />
      ))}
    </SectionCard>
  );
}
