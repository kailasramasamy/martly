export interface TripStats {
  total: number;
  active: number;
  completed: number;
}

export interface Rider {
  id: string;
  name: string;
  phone: string | null;
  email: string;
  createdAt: string;
  tripStats: TripStats;
}

export interface RiderOption {
  id: string;
  name: string;
  phone: string | null;
  email: string;
}

export interface BoardOrder {
  id: string;
  status: string;
  totalAmount: string;
  fulfillmentType: "DELIVERY" | "PICKUP";
  deliveryAddress: string | null;
  deliveryPincode: string | null;
  deliverySlotId: string | null;
  deliveryTripId: string | null;
  slotStartTime: string | null;
  slotEndTime: string | null;
  createdAt: string;
  user: { id: string; name: string };
  items: { quantity: number; product: { name: string } }[];
  deliveryTrip: { id: string; status: string; rider: { id: string; name: string; phone: string | null } } | null;
}

export interface SlotGroup {
  slotId: string;
  startTime: string;
  endTime: string;
  maxOrders: number;
  orders: BoardOrder[];
}

export interface BoardData {
  date: string;
  express: BoardOrder[];
  scheduled: Record<string, SlotGroup>;
  pickup: BoardOrder[];
}

export interface TripOrder {
  id: string;
  status: string;
  totalAmount: string;
  deliveryAddress: string | null;
  deliveryPincode: string | null;
  user: { id: string; name: string };
}

export interface Trip {
  id: string;
  status: "CREATED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  startedAt: string | null;
  createdAt: string;
  rider: { id: string; name: string; phone: string | null };
  orders: TripOrder[];
}
