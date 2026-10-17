import { axiosInstance } from "../../providers/data-provider";

export interface CreatePromoBody {
  brief: string;
  autoLaunch: boolean;
  notify: boolean;
  organizationId?: string;
  imageUrl?: string;
}

export const formatRupees = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export const formatRange = (min: number, max: number) =>
  min === max ? formatRupees(min) : `${formatRupees(min)}–${formatRupees(max)}`;

export function discountLabel(type: "FLAT" | "PERCENTAGE" | null, value: number | null): string {
  if (!type || value == null) return "—";
  return type === "PERCENTAGE" ? `${value}% off` : `${formatRupees(value)} off`;
}

export async function createPromo(body: CreatePromoBody): Promise<string> {
  const res = await axiosInstance.post("/promos", body);
  return res.data.data.id;
}
