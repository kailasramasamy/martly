import { currentISTHour } from "../utils/timezone.js";

export type TimePeriod = "morning" | "afternoon" | "evening" | "night";

export const TIME_CATEGORY_MAP: Record<TimePeriod, string[]> = {
  morning: ["Fresh Curd (Dahi)", "Full Cream Milk", "Brown & Whole Wheat Bread", "Sandwich Bread", "Brown Eggs", "White Eggs", "Salted Butter", "Instant Coffee", "Tea Bags"],
  afternoon: ["Potato Chips", "Instant Noodles", "Cream Biscuits", "Fruit Juice (100%)", "Flavoured Milk", "Cup Noodles", "Kurkure & Extruded Snacks"],
  evening: ["Tomato", "Onion & Garlic", "Potato", "Ground Spices", "Sunflower Oil", "Chicken Curry Cut", "Basmati Rice", "Wheat Atta"],
  night: ["Frozen Pizza & Burger Patty", "Ice Cream Tubs", "Chocolate Bars & Countlines", "Frozen Samosa & Spring Roll", "Bhujia & Sev", "Mixture & Chivda"],
};

export const TIME_PERIOD_TITLES: Record<TimePeriod, string> = {
  morning: "Breakfast essentials",
  afternoon: "Afternoon snack break",
  evening: "Dinner prep",
  night: "Late-night cravings",
};

// Stores are all in India, so the period follows IST rather than the server clock
export function getTimePeriod(hour: number = currentISTHour()): TimePeriod {
  if (hour >= 6 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}
