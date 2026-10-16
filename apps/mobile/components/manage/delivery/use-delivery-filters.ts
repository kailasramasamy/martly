import { useState } from "react";
import type { FilterChip } from "../ui/FilterChipBar";
import type { SelectOption } from "../ui/OptionSheet";
import type { Anchor } from "../ui/OptionDropdown";
import {
  NO_DELIVERY_FILTERS, PAYMENT_OPTIONS, VIEW_OPTIONS, activeDeliveryFilterCount, pincodeOptions, riderOptions,
  type DeliveryFilters,
} from "./filters";
import type { BoardData, Trip } from "./types";

type Key = keyof DeliveryFilters;

const TITLES: Record<Key, string> = { view: "Status", pincode: "Area", payment: "Payment", riderId: "Rider" };

/** Chip-bar state for the delivery board: one dropdown per filter, opened below its chip, and clear */
export function useDeliveryFilters(board: BoardData | null, trips: Trip[]) {
  const [filters, setFilters] = useState<DeliveryFilters>(NO_DELIVERY_FILTERS);
  const [open, setOpen] = useState<{ key: Key; anchor: Anchor } | null>(null);

  const options: Record<Key, SelectOption[]> = {
    view: VIEW_OPTIONS,
    pincode: pincodeOptions(board),
    payment: PAYMENT_OPTIONS,
    riderId: riderOptions(trips),
  };
  const labelOf = (key: Key) => options[key].find((o) => o.value === filters[key])?.label;

  const chips: FilterChip[] = (Object.keys(TITLES) as Key[]).map((key) => ({
    key,
    label: TITLES[key],
    value: filters[key] ? labelOf(key) : undefined,
    onPress: (anchor: Anchor) => setOpen({ key, anchor }),
  }));

  const picker = {
    anchor: open?.anchor ?? null,
    options: open ? options[open.key] : [],
    value: open ? filters[open.key] : null,
    onPick: (value: string) => {
      if (open) setFilters((f) => ({ ...f, [open.key]: value }));
      setOpen(null);
    },
    onClose: () => setOpen(null),
  };

  return {
    filters,
    chips,
    activeCount: activeDeliveryFilterCount(filters),
    clear: () => setFilters(NO_DELIVERY_FILTERS),
    openAll: (anchor: Anchor) => setOpen({ key: "view", anchor }),
    picker,
  };
}
