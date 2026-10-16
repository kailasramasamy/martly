import type { ReactNode } from "react";
import { Popconfirm } from "antd";
import { handoverNote } from "@martly/shared/order-flow";

interface ConfirmFinalStepProps {
  status: string;
  label: string;
  order: {
    id: string;
    totalAmount: string | number;
    paymentMethod?: string;
    paymentStatus?: string;
    walletAmountUsed?: string | number | null;
    loyaltyPointsUsed?: number | null;
  };
  onConfirm: () => void;
  /** Renders the action button; it gets an onClick only when no confirmation is needed */
  children: (onClick?: () => void) => ReactNode;
}

/** Marking an order delivered (or picked up) completes payment, stock and loyalty, so it asks first; other steps go straight through */
export function ConfirmFinalStep({ status, label, order, onConfirm, children }: ConfirmFinalStepProps) {
  if (status !== "DELIVERED") return <>{children(onConfirm)}</>;
  return (
    <Popconfirm
      title={`${label} #${order.id.slice(0, 8)}?`}
      description={handoverNote(order)}
      okText={label}
      cancelText="Not yet"
      onConfirm={onConfirm}
    >
      {children()}
    </Popconfirm>
  );
}
