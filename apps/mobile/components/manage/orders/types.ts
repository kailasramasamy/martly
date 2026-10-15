export interface OrderListItem {
  id: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  fulfillmentType: string;
  totalAmount: string;
  createdAt: string;
  user: { id: string; name: string; email: string };
  items: { id: string }[];
}

export interface OrderDetailItem {
  id: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
  product: { name: string; imageUrl: string | null; images: string[] };
  variant: { name: string; imageUrl: string | null };
}

export interface OrderDetail {
  id: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  fulfillmentType: string;
  totalAmount: string;
  deliveryFee: string;
  deliveryAddress: string | null;
  deliveryNotes: string | null;
  couponCode: string | null;
  couponDiscount: string | null;
  walletAmountUsed: string | null;
  loyaltyPointsUsed: number | null;
  loyaltyPointsEarned: number | null;
  razorpayPaymentId: string | null;
  scheduledDate: string | null;
  slotStartTime: string | null;
  slotEndTime: string | null;
  estimatedDeliveryAt: string | null;
  deliverySequence: number | null;
  createdAt: string;
  updatedAt: string;
  user: { id: string; name: string; email: string; phone: string | null };
  items: OrderDetailItem[];
  statusLogs: { id: string; status: string; note: string | null; createdAt: string }[];
  returnRequest: { id: string; status: string; requestedAmount: string | null; approvedAmount: string | null } | null;
  deliveryTrip: { id: string; status: string; rider: { name: string; phone: string | null } } | null;
}
