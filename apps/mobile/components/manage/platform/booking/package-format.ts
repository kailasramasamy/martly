import type { BrandPackage } from "../types";
import { formatINR } from "../../ui/tokens";

/** "₹4,999 / week", "₹9,999 / 14 days", "₹250 / 1,000 views" */
export const packagePrice = (p: BrandPackage) =>
  `${formatINR(p.price)} / ${p.kind === "BRAND_CPM" ? "1,000 views" : p.durationDays === 7 ? "week" : `${p.durationDays} days`}`;
