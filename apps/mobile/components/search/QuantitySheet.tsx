import { useMemo } from "react";
import { RadioOptionSheet, type RadioOption } from "./RadioOptionSheet";
import type { SearchFacets } from "../../lib/types";

interface QuantitySheetProps {
  visible: boolean;
  sizes: SearchFacets["sizes"];
  selected: string | null;
  onSelect: (value: string | null) => void;
  onClose: () => void;
}

export function QuantitySheet({ visible, sizes, selected, onSelect, onClose }: QuantitySheetProps) {
  const options = useMemo<RadioOption<string | null>[]>(
    () => [{ value: null, label: "Any" }, ...sizes.map((s) => ({ value: s.label, label: s.label, count: s.count }))],
    [sizes],
  );
  return <RadioOptionSheet visible={visible} title="Quantity" options={options} selected={selected} onSelect={onSelect} onClose={onClose} />;
}
