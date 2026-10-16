import type { StockMovementType } from "@martly/shared/constants";

export type CountStatus = "DRAFT" | "SUBMITTED" | "RECOUNT" | "APPROVED" | "REJECTED";

export interface StockCountRow {
  id: string;
  status: CountStatus;
  store: { id: string; name: string };
  subcategory: { id: string; name: string };
  createdBy: { id: string; name: string };
  _count: { lines: number };
  createdAt: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  /** The approver's note, e.g. why lines were sent back for recount */
  reviewNote: string | null;
}

export interface CountRevision {
  kind: "COUNT" | "RECOUNT" | "CORRECTION";
  qty: number;
  reason: string | null;
  userName: string;
  createdAt: string;
}

export interface StockCountItem {
  storeProductId: string;
  productName: string;
  variantName: string;
  imageUrl: string | null;
  countedQty: number | null;
  /** Only present when the viewer may see system stock */
  systemQty?: number | null;
  difference?: number | null;
  /** Approver-only: flagged for recount, already applied to stock, and the count history (oldest first) */
  recountRequested?: boolean;
  applied?: boolean;
  revisions?: CountRevision[];
}

export interface StockCountDetail {
  id: string;
  status: CountStatus;
  note: string | null;
  reviewNote: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  store: { id: string; name: string };
  subcategory: { id: string; name: string };
  createdBy: { name: string };
  reviewedBy: { name: string } | null;
  items: StockCountItem[];
  countedItems: number;
  /** Lines currently flagged for recount */
  recountItems: number;
  canSeeSystemStock: boolean;
}

export interface StockMovementRow {
  id: string;
  type: StockMovementType;
  quantity: number;
  stockBefore: number;
  stockAfter: number;
  note: string | null;
  createdAt: string;
  user: { name: string } | null;
  storeProduct: { product: { name: string }; variant: { name: string } };
}

export const COUNT_STATUS: Record<CountStatus, { label: string; color: string; bg: string }> = {
  DRAFT: { label: "In progress", color: "#1d4ed8", bg: "#dbeafe" },
  SUBMITTED: { label: "To review", color: "#b45309", bg: "#fef3c7" },
  RECOUNT: { label: "Recount", color: "#c2410c", bg: "#ffedd5" },
  APPROVED: { label: "Approved", color: "#15803d", bg: "#dcfce7" },
  REJECTED: { label: "Rejected", color: "#b91c1c", bg: "#fee2e2" },
};
