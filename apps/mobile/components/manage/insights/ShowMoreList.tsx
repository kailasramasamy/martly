import { useState, type ReactNode } from "react";
import { Button } from "../ui/Button";
import { SectionCard } from "../ui/SectionCard";
import { EmptyState } from "../ui/EmptyState";

interface ShowMoreListProps<T> {
  title: string;
  items: T[];
  pageSize?: number;
  emptyTitle: string;
  renderItem: (item: T) => ReactNode;
}

/** Card of rows that reveals `pageSize` more on demand, for analytics lists that arrive unpaged */
export function ShowMoreList<T>({ title, items, pageSize = 20, emptyTitle, renderItem }: ShowMoreListProps<T>) {
  const [shown, setShown] = useState(pageSize);
  if (items.length === 0) return <EmptyState icon="checkmark-circle-outline" title={emptyTitle} />;
  return (
    <SectionCard title={title} flush>
      {items.slice(0, shown).map(renderItem)}
      {items.length > shown && <Button label={`Show more (${items.length - shown})`} variant="ghost" onPress={() => setShown(shown + pageSize)} />}
    </SectionCard>
  );
}
