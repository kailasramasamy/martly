import { useRouter } from "expo-router";
import type { StoreOfferKind } from "@martly/shared/types";
import { ListRow } from "../ui/ListRow";
import { SectionCard } from "../ui/SectionCard";

const PRODUCT_KINDS: { kind: StoreOfferKind; title: string; subtitle: string; icon: "gift-outline" | "pricetag-outline" | "diamond-outline" }[] = [
  { kind: "BUY_GET", title: "Buy X get Y free", subtitle: "1 + 1, 2 + 1 or your own", icon: "gift-outline" },
  { kind: "DISCOUNT", title: "Discount", subtitle: "₹ or % off the price", icon: "pricetag-outline" },
  { kind: "MEMBER_PRICE", title: "Member price", subtitle: "A lower price for Mart Plus members", icon: "diamond-outline" },
];

/** The offers set on products, and the order-wide ones that have their own screens */
export function OfferKindPicker({ value, onChange }: { value: StoreOfferKind; onChange: (kind: StoreOfferKind) => void }) {
  const router = useRouter();
  return (
    <>
      <SectionCard title="On products" flush>
        {PRODUCT_KINDS.map((k) => (
          <ListRow key={k.kind} title={k.title} subtitle={k.subtitle} icon={k.icon} selected={value === k.kind} onPress={() => onChange(k.kind)} />
        ))}
      </SectionCard>
      <SectionCard title="On the whole order" flush>
        <ListRow title="Coupon code" subtitle="₹ or % off the order, with a minimum and limits" icon="ticket-outline" chevron onPress={() => router.push("/manage/coupons/new")} />
        <ListRow title="Promotion" subtitle="Discount on a category, with a banner and a push" icon="megaphone-outline" chevron onPress={() => router.push("/manage/promos/new")} />
      </SectionCard>
    </>
  );
}
