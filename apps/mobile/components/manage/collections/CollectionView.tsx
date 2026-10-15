import { CollectionKindLabels, type CollectionKind } from "@martly/shared/constants";
import { SectionCard } from "../ui/SectionCard";
import { KeyValue } from "../ui/KeyValue";
import { ListRow } from "../ui/ListRow";
import { StatusPill } from "../ui/StatusPill";
import { formatDate } from "../ui/dates";
import { collectionStatus } from "./status";
import type { CollectionDetail } from "./types";

/** Read-only view for roles (or collections) the user cannot edit */
export function CollectionView({ collection }: { collection: CollectionDetail }) {
  const status = collectionStatus(collection);
  return (
    <>
      <SectionCard title="Collection">
        <KeyValue label="Title" value={collection.title} />
        <KeyValue label="Subtitle" value={collection.subtitle} />
        <KeyValue label="Kind" value={CollectionKindLabels[collection.kind as CollectionKind] ?? collection.kind} />
        <KeyValue label="Scope" value={collection.organization?.name ?? "Global"} />
        <KeyValue label="Starts" value={formatDate(collection.startsAt)} />
        <KeyValue label="Ends" value={formatDate(collection.endsAt)} />
        <StatusPill label={status.label} color={status.color} bg={status.bg} />
      </SectionCard>
      <SectionCard title={`Products (${collection.items.length})`} flush>
        {collection.items.map(({ product }) => (
          <ListRow key={product.id} title={product.name} subtitle={product.brand?.name} imageUrl={product.imageUrl} />
        ))}
      </SectionCard>
    </>
  );
}
