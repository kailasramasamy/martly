import { SectionCard } from "../ui/SectionCard";
import { ListRow } from "../ui/ListRow";
import { Stars } from "../reviews/Stars";
import type { RatedProduct } from "../reviews/types";

export function ProductRatingList({ title, products }: { title: string; products: RatedProduct[] }) {
  return (
    <SectionCard title={title} flush>
      {products.length === 0
        ? <ListRow title="Not enough reviews yet" subtitle="Products need at least 2 approved reviews." />
        : products.map((p) => (
          <ListRow
            key={p.productId}
            imageUrl={p.imageUrl}
            title={p.name}
            subtitle={`${p.avgRating.toFixed(1)} avg · ${p.reviewCount} reviews`}
            trailing={<Stars value={p.avgRating} size={11} />}
          />
        ))}
    </SectionCard>
  );
}
