export const FOOD_TYPE_CONFIG: Record<string, { color: string; label: string }> = {
  VEG: { color: "green", label: "Veg" },
  NON_VEG: { color: "red", label: "Non-Veg" },
  VEGAN: { color: "lime", label: "Vegan" },
  EGG: { color: "orange", label: "Egg" },
};

export const PRODUCT_TYPE_CONFIG: Record<string, { color: string; label: string }> = {
  GROCERY: { color: "green", label: "Grocery" },
  SNACKS: { color: "orange", label: "Snacks" },
  BEVERAGES: { color: "blue", label: "Beverages" },
  DAIRY: { color: "cyan", label: "Dairy" },
  FROZEN: { color: "geekblue", label: "Frozen" },
  FRESH_PRODUCE: { color: "lime", label: "Fresh Produce" },
  BAKERY: { color: "gold", label: "Bakery" },
  PERSONAL_CARE: { color: "purple", label: "Personal Care" },
  HOUSEHOLD: { color: "magenta", label: "Household" },
  BABY_CARE: { color: "pink", label: "Baby Care" },
  PET_CARE: { color: "volcano", label: "Pet Care" },
  OTC_PHARMA: { color: "red", label: "OTC Pharma" },
};

export const PRODUCT_TYPE_OPTIONS = Object.entries(PRODUCT_TYPE_CONFIG).map(([value, { label }]) => ({
  label,
  value,
}));

export const STORAGE_TYPE_CONFIG: Record<string, { color: string; label: string }> = {
  AMBIENT: { color: "default", label: "Room Temp" },
  REFRIGERATED: { color: "blue", label: "Refrigerated (2-8°C)" },
  DEEP_CHILLED: { color: "cyan", label: "Deep Chilled (0-2°C)" },
  FROZEN: { color: "geekblue", label: "Frozen (-18°C)" },
  COOL_DRY: { color: "green", label: "Cool & Dry" },
  HUMIDITY_CONTROLLED: { color: "purple", label: "Humidity Controlled" },
};

export const STORAGE_TYPE_OPTIONS = Object.entries(STORAGE_TYPE_CONFIG).map(([value, { label }]) => ({
  label,
  value,
}));

export const ORDER_STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  PENDING: { color: "orange", label: "Pending" },
  CONFIRMED: { color: "blue", label: "Confirmed" },
  PREPARING: { color: "cyan", label: "Preparing" },
  READY: { color: "geekblue", label: "Ready" },
  OUT_FOR_DELIVERY: { color: "purple", label: "Out for Delivery" },
  DELIVERED: { color: "green", label: "Delivered" },
  CANCELLED: { color: "red", label: "Cancelled" },
};

export const PAYMENT_STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  PENDING: { color: "orange", label: "Pending" },
  PAID: { color: "green", label: "Paid" },
  FAILED: { color: "red", label: "Failed" },
};

export const STORE_STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  ACTIVE: { color: "green", label: "Active" },
  PENDING: { color: "orange", label: "Pending" },
  INACTIVE: { color: "red", label: "Inactive" },
};

export const ACTIVE_STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  true: { color: "green", label: "Active" },
  false: { color: "red", label: "Inactive" },
};

export const FULFILLMENT_TYPE_CONFIG: Record<string, { color: string; label: string }> = {
  DELIVERY: { color: "blue", label: "Delivery" },
  PICKUP: { color: "green", label: "Pickup" },
};

export const FULFILLMENT_TYPE_OPTIONS = Object.entries(FULFILLMENT_TYPE_CONFIG).map(([value, { label }]) => ({
  label,
  value,
}));

export const DISCOUNT_TYPE_CONFIG: Record<string, { color: string; label: string }> = {
  FLAT: { color: "blue", label: "Flat" },
  PERCENTAGE: { color: "purple", label: "Percentage" },
};

export const DISCOUNT_TYPE_OPTIONS = [
  { label: "Flat Amount (₹)", value: "FLAT" },
  { label: "Percentage (%)", value: "PERCENTAGE" },
];

export const LOYALTY_TRANSACTION_TYPE_CONFIG: Record<string, { color: string; label: string }> = {
  EARN: { color: "gold", label: "Earned" },
  REDEEM: { color: "purple", label: "Redeemed" },
  REVERSAL: { color: "orange", label: "Reversal" },
  ADJUSTMENT: { color: "blue", label: "Adjustment" },
};

export const TRIP_STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  CREATED: { color: "blue", label: "Created" },
  IN_PROGRESS: { color: "orange", label: "In Progress" },
  COMPLETED: { color: "green", label: "Completed" },
  CANCELLED: { color: "red", label: "Cancelled" },
};
