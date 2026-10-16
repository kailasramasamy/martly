import { EmptyState } from "../ui/EmptyState";
import { GridSkeleton } from "../ui/GridSkeleton";

interface CatalogEmptyProps {
  loading: boolean;
  error: string | null;
  filtered: boolean;
  onRetry: () => void;
  /** The grid's geometry, so the loading placeholders match its tiles */
  grid: { columns: number; width: number; gap: number; padding: number };
}

export function CatalogEmpty({ loading, error, filtered, onRetry, grid }: CatalogEmptyProps) {
  if (loading) return <GridSkeleton {...grid} />;
  if (error) return <EmptyState icon="cloud-offline-outline" title="Couldn't load" message={error} action={{ label: "Try again", onPress: onRetry }} />;
  return (
    <EmptyState
      icon="cube-outline"
      title="No products here"
      message={filtered ? "Nothing matches these filters." : "Add products to start selling from this store."}
    />
  );
}
