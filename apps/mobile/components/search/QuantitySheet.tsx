import { useMemo } from "react";
import { RadioOptionSheet, type RadioOption } from "./RadioOptionSheet";
import { useStrings } from "../../lib/i18n/use-strings";
import type { SearchFacets } from "../../lib/types";

interface QuantitySheetProps {
  visible: boolean;
  sizes: SearchFacets["sizes"];
  selected: string | null;
  onSelect: (value: string | null) => void;
  onClose: () => void;
}

export function QuantitySheet({ visible, sizes, selected, onSelect, onClose }: QuantitySheetProps) {
  const t = useStrings("search");
  const options = useMemo<RadioOption<string | null>[]>(
    () => [{ value: null, label: t.any }, ...sizes.map((s) => ({ value: s.label, label: s.label, count: s.count }))],
    [sizes, t],
  );
  return <RadioOptionSheet visible={visible} title={t.quantity} options={options} selected={selected} onSelect={onSelect} onClose={onClose} />;
}
