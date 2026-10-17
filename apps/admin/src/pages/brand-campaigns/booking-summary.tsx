import { useEffect, useState } from "react";
import { Alert, Typography } from "antd";
import { isAxiosError } from "axios";
import dayjs, { type Dayjs } from "dayjs";
import { axiosInstance } from "../../providers/data-provider";
import { formatRupees } from "../promos/promo-utils";
import type { CampaignScope } from "./types";
import type { AdProduct } from "../marketing/types";

interface Availability { cap: number | null; booked: number; available: boolean; startsAt: string; endsAt: string }

interface BookingSummaryProps {
  scope: CampaignScope;
  product?: AdProduct;
  quantity: number;
  startsAt?: Dayjs;
  categoryId?: string;
  excludeId?: string;
}

function useAvailability({ scope, product, quantity, startsAt, categoryId, excludeId }: BookingSummaryProps) {
  const [slot, setSlot] = useState<Availability | null>(null);
  const startKey = startsAt?.toISOString();

  useEffect(() => {
    setSlot(null);
    if (!product || !startKey || !quantity) return;
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
  if (!slot.available) return { text: "Fully booked", full: true };
  return { text: `${slot.booked} of ${slot.cap} brand slots booked · runs until ${until}`, full: false };
}

export function BookingSummary(props: BookingSummaryProps) {
  const slot = useAvailability(props);
  const { product, quantity } = props;
  const status = slot ? availabilityText(slot) : null;
  return (
    <>
      {status && <Alert type={status.full ? "error" : "info"} showIcon message={status.text} style={{ marginBottom: 12 }} />}
      {product && (
        <Typography.Text strong>
          {formatRupees(product.price * quantity)} <Typography.Text type="secondary">+{product.gstPercent}% GST</Typography.Text>
        </Typography.Text>
      )}
    </>
  );
}
