import { listingLabel, listingState, type ListingState, type VariantListing } from "@martly/shared/listing";
import { StatusPill } from "../ui/StatusPill";

const TONE: Record<ListingState["kind"], { color: string; bg: string }> = {
  listed: { color: "#15803d", bg: "#dcfce7" },
  outOfStock: { color: "#92400e", bg: "#fef3c7" },
  hidden: { color: "#475569", bg: "#e2e8f0" },
  notListed: { color: "#64748b", bg: "#ffffff" },
  stores: { color: "#0f766e", bg: "#ccfbf1" },
};

export const DraftPill = () => <StatusPill label="Draft" color="#b45309" bg="#fef3c7" />;

interface ListingPillProps {
  listings: readonly VariantListing[] | undefined;
  /** The selected store; null shows how many stores list it */
  storeId: string | null;
}

/** How the product sits in the store's range: listed, out of stock, hidden or not listed */
export function ListingPill({ listings, storeId }: ListingPillProps) {
  const state = listingState(listings ?? [], storeId);
  return <StatusPill label={listingLabel(state)} {...TONE[state.kind]} />;
}
