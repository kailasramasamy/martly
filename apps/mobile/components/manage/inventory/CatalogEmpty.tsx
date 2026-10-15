import { EmptyState } from "../ui/EmptyState";
import { ListSkeleton } from "../ui/ListSkeleton";

interface CatalogEmptyProps {
  loading: boolean;
  error: string | null;
  filtered: boolean;
  onRetry: () => void;
}

export function CatalogEmpty({ loading, error, filtered, onRetry }: CatalogEmptyProps) {
  if (loading) return <ListSkeleton />;
  if (error) return <EmptyState icon="cloud-offline-outline" title="Couldn't load" message={error} action={{ label: "Try again", onPress: onRetry }} />;
  return (
    <EmptyState
      icon="cube-outline"
      title="No products here"
      message={filtered ? "Nothing matches these filters." : "Add products to start selling from this store."}
    />
  );
}
