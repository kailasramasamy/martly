/** Walk-the-store flags for this app session: nudges stop once the shopper has walked, or hidden one */
export const walkSession = {
  walked: false,
  dismissed: new Set<"cart" | "checkout">(),
};

// About 15 seconds an aisle, never under a minute
export const walkMinutes = (aisles: number) => Math.max(1, Math.round((aisles * 15) / 60));
