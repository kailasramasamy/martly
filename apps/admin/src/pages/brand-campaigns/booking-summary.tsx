import { useEffect, useState } from "react";
import { Alert, Button, Typography } from "antd";
import { isAxiosError } from "axios";
import dayjs, { type Dayjs } from "dayjs";
import { axiosInstance } from "../../providers/data-provider";
import { formatRupees } from "../promos/promo-utils";
import type { CampaignScope } from "./types";
import type { AdProduct } from "../marketing/types";

interface Availability { cap: number | null; booked: number; available: boolean; nextStartsAt: string | null; startsAt: string; endsAt: string }

interface BookingSummaryProps {
  scope: CampaignScope;
  product?: AdProduct;
  quantity: number;
  startsAt?: Dayjs;
  categoryId?: string;
  excludeId?: string;
  /** Moves the booking to the suggested start when its dates are full */
  onUseStart?: (startsAt: Dayjs) => void;
}

function useAvailability({ scope, product, quantity, startsAt, categoryId, excludeId }: BookingSummaryProps) {
  const [slot, setSlot] = useState<Availability | null>(null);
  const startKey = startsAt?.toISOString();

  useEffect(() => {
    setSlot(null);
    if (!product || !startKey || !quantity) return;
    // Sponsored products and featured brands are booked per category
    if ((product.kind === "BRAND_SPONSORED_PRODUCT" || product.kind === "BRAND_FEATURE") && !categoryId) return;
    axiosInstance
      .get(`${scope.apiBase}/availability`, { params: { productId: product.id, quantity, startsAt: startKey, categoryId, excludeId } })
      .then((res) => setSlot(res.data.data))
      .catch((err) => {
        if (!isAxiosError(err)) throw err;
      });
  }, [scope.apiBase, product, quantity, startKey, categoryId, excludeId]);
  return slot;
}

function availabilityText(slot: Availability): { text: string; full: boolean } {
  const until = dayjs(slot.endsAt).format("D MMM");
  if (slot.cap === null) return { text: `Open slots · runs until ${until}`, full: false };
  if (!slot.available) {
    const next = slot.nextStartsAt ? ` · next opening ${dayjs(slot.nextStartsAt).format("ddd, D MMM")}` : "";
    return { text: `Fully booked${next}`, full: true };
  }
  return { text: `${slot.booked} of ${slot.cap} brand slots booked · runs until ${until}`, full: false };
}

export function BookingSummary(props: BookingSummaryProps) {
  const slot = useAvailability(props);
  const { product, quantity, onUseStart } = props;
  const status = slot ? availabilityText(slot) : null;
  const next = slot?.nextStartsAt;
  return (
    <>
      {status && (
        <Alert
          type={status.full ? "error" : "info"} showIcon message={status.text} style={{ marginBottom: 12 }}
          action={next && onUseStart ? <Button size="small" onClick={() => onUseStart(dayjs(next))}>Start then</Button> : undefined}
        />
      )}
      {product && (
        <Typography.Text strong>
          {formatRupees(product.price * quantity)} <Typography.Text type="secondary">+{product.gstPercent}% GST</Typography.Text>
        </Typography.Text>
      )}
    </>
  );
}
