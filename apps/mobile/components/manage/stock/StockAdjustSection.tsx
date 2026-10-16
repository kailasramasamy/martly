import { useState } from "react";
import { SectionCard } from "../ui/SectionCard";
import { Button } from "../ui/Button";
import { AdjustStockSheet } from "./AdjustStockSheet";
import { StockHistoryCard } from "./StockHistoryCard";
import { useStockAccess } from "./use-stock-access";

interface StockAdjustSectionProps {
  storeProductId: string;
  currentStock: number;
  onChanged: () => void;
}

/** Adjust-stock action (STOCK_ADJUST) and recent history (STOCK_VIEW) for a store listing */
export function StockAdjustSection({ storeProductId, currentStock, onChanged }: StockAdjustSectionProps) {
  const { canAdjust, canView } = useStockAccess();
  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState(0);
  if (!canAdjust && !canView) return null;

  const adjusted = () => {
    setVersion((v) => v + 1);
    onChanged();
  };

  return (
    <>
      {canAdjust && (
        <SectionCard title="Adjust stock">
          <Button label="Adjust stock" icon="construct-outline" variant="secondary" onPress={() => setOpen(true)} />
        </SectionCard>
      )}
      {canView && <StockHistoryCard storeProductId={storeProductId} refreshKey={version} />}
      <AdjustStockSheet visible={open} storeProductId={storeProductId} currentStock={currentStock} onClose={() => setOpen(false)} onAdjusted={adjusted} />
    </>
  );
}
