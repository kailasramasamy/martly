import { Tag, Tooltip } from "antd";
import dayjs from "dayjs";
import { DELIVERY_FAILURE_LABELS } from "@martly/shared/constants";
import type { DeliveryFailure } from "./types";

/** The latest failed delivery attempt on an order, with the rider's note and time on hover */
export function FailureTag({ failure }: { failure?: DeliveryFailure }) {
  if (!failure) return null;
  const detail = [failure.note, dayjs(failure.createdAt).format("DD MMM, HH:mm")].filter(Boolean).join(" · ");
  return (
    <Tooltip title={detail}>
      <Tag color="red">Failed: {DELIVERY_FAILURE_LABELS[failure.reason] ?? failure.reason}</Tag>
    </Tooltip>
  );
}
