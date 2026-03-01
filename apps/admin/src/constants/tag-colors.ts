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

export const BANNER_PLACEMENT_CONFIG: Record<string, { color: string; label: string }> = {
  HERO_CAROUSEL: { color: "blue", label: "Hero Carousel" },
  CATEGORY_STRIP: { color: "cyan", label: "Category Strip" },
  MID_PAGE: { color: "purple", label: "Mid Page" },
  CATEGORY_TOP: { color: "geekblue", label: "Category Top" },
  CART_UPSELL: { color: "orange", label: "Cart Upsell" },
  POPUP: { color: "magenta", label: "Popup" },
};

export const BANNER_ACTION_TYPE_CONFIG: Record<string, { color: string; label: string }> = {
  CATEGORY: { color: "green", label: "Category" },
  PRODUCT: { color: "blue", label: "Product" },
  COLLECTION: { color: "purple", label: "Collection" },
  SEARCH: { color: "cyan", label: "Search" },
  URL: { color: "orange", label: "URL" },
  NONE: { color: "default", label: "None" },
};

export const NOTIFICATION_TYPE_CONFIG: Record<string, { color: string; label: string }> = {
  ORDER_CONFIRMED: { color: "blue", label: "Order Confirmed" },
  ORDER_PREPARING: { color: "orange", label: "Preparing" },
  ORDER_READY: { color: "geekblue", label: "Ready" },
  ORDER_OUT_FOR_DELIVERY: { color: "purple", label: "Out for Delivery" },
  ORDER_DELIVERED: { color: "green", label: "Delivered" },
  ORDER_CANCELLED: { color: "red", label: "Cancelled" },
  WALLET_CREDITED: { color: "cyan", label: "Wallet Credited" },
  WALLET_DEBITED: { color: "cyan", label: "Wallet Debited" },
  LOYALTY_POINTS_EARNED: { color: "gold", label: "Points Earned" },
  LOYALTY_POINTS_REDEEMED: { color: "gold", label: "Points Redeemed" },
  PROMOTIONAL: { color: "magenta", label: "Promotional" },
  WELCOME: { color: "blue", label: "Welcome" },
  REVIEW_REQUEST: { color: "orange", label: "Review Request" },
};

export const TRIP_STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  CREATED: { color: "blue", label: "Created" },
  IN_PROGRESS: { color: "orange", label: "In Progress" },
  COMPLETED: { color: "green", label: "Completed" },
  CANCELLED: { color: "red", label: "Cancelled" },
};

export const CAMPAIGN_STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  DRAFT: { color: "default", label: "Draft" },
  SCHEDULED: { color: "blue", label: "Scheduled" },
  SENDING: { color: "orange", label: "Sending" },
  SENT: { color: "green", label: "Sent" },
  FAILED: { color: "red", label: "Failed" },
};

export const AUDIENCE_TYPE_CONFIG: Record<string, { color: string; label: string }> = {
  ALL_CUSTOMERS: { color: "blue", label: "All Customers" },
  STORE_CUSTOMERS: { color: "cyan", label: "Store Customers" },
  ORDERED_LAST_N_DAYS: { color: "green", label: "Recent Buyers" },
  NOT_ORDERED_N_DAYS: { color: "orange", label: "Inactive" },
  HIGH_VALUE_CUSTOMERS: { color: "gold", label: "High Value" },
};

export const REFERRAL_STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  PENDING: { color: "orange", label: "Pending" },
  COMPLETED: { color: "green", label: "Completed" },
  EXPIRED: { color: "red", label: "Expired" },
};

export const TICKET_STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  OPEN: { color: "orange", label: "Open" },
  RESOLVED: { color: "green", label: "Resolved" },
  CLOSED: { color: "default", label: "Closed" },
};

export const TICKET_PRIORITY_CONFIG: Record<string, { color: string; label: string }> = {
  LOW: { color: "default", label: "Low" },
  MEDIUM: { color: "blue", label: "Medium" },
  HIGH: { color: "red", label: "High" },
};
