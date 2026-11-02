import type { CartItem } from "../../lib/cart-context";

// As in a real shop: a basket for a few things, a trolley once there's more than a basket holds. Counted in products,
// not units, as that's what the shopper sees in it
const TROLLEY_FROM_PRODUCTS = 7;

export const carriesTrolley = (items: CartItem[]) => items.length >= TROLLEY_FROM_PRODUCTS;
