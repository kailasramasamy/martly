/** Who a post's push would reach, and why: the aisles' buyers, or everyone because it's new, untagged, or the aisles have too few */
export interface PostAudience {
  count: number;
  scope: "AISLES" | "NEW" | "UNTAGGED" | "FEW_BUYERS";
  /** How many bought from the tagged aisles, when they were counted */
  aisleBuyers: number | null;
}

const plural = (n: number) => (n === 1 ? "1 shopper" : `${n} shoppers`);

/** The line under "Notify shoppers" in the post forms (Manage and admin); null while it's being counted */
export function describeAudience(audience: PostAudience | null) {
  const cap = "One notification a day at most.";
  if (!audience) return `Counting shoppers… ${cap}`;
  const all = `all ${plural(audience.count)} who ordered here in the last 60 days`;
  const who = {
    AISLES: `${plural(audience.count)} who bought from these aisles lately will get this.`,
    NEW: `New arrivals go to ${all}.`,
    UNTAGGED: `No products tagged, so ${all} will get this.`,
    FEW_BUYERS: `Only ${plural(audience.aisleBuyers ?? 0)} bought from these aisles lately, so ${all} will get this.`,
  }[audience.scope];
  return `${who} ${cap}`;
}
