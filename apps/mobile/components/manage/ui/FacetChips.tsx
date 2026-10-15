import { SegmentedTabs } from "./SegmentedTabs";

export interface Facet {
  id: string;
  name: string;
  count: number;
}

export interface SearchFacetsMeta {
  facets?: { subcategories: Facet[]; brands?: Facet[] };
}

interface FacetChipsProps {
  facets: Facet[] | undefined;
  value: string | null;
  onChange: (id: string | null) => void;
  /** Label of the reset chip, e.g. "All" or "All brands" */
  allLabel?: string;
}

/** Search-result breakdown ("All 18 · Detergent Powder 10 · Liquid Detergent 4"); hidden when there's nothing to narrow */
export function FacetChips({ facets, value, onChange, allLabel = "All" }: FacetChipsProps) {
  if (!facets || facets.length < 2) return null;
  const all = facets.reduce((sum, f) => sum + f.count, 0);
  const options = [
    { value: "", label: allLabel, count: all },
    ...facets.map((f) => ({ value: f.id, label: f.name, count: f.count })),
  ];
  return <SegmentedTabs options={options} value={value ?? ""} onChange={(v) => onChange(v || null)} countTone="neutral" />;
}
