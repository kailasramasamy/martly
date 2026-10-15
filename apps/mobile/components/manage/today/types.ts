export interface DashboardKpis {
  totalRevenue: number;
  previousRevenue: number;
  totalOrders: number;
  previousOrders: number;
  averageOrderValue: number;
  previousAOV: number;
  totalCustomers: number;
  previousCustomers: number;
}

export interface DashboardStats {
  kpis: DashboardKpis;
  revenueOverTime: { date: string; revenue: number }[];
  ordersOverTime: { date: string; count: number }[];
  topProducts: { name: string; quantity: number; revenue: number }[];
  recentOrders: {
    id: string;
    status: string;
    totalAmount: number;
    paymentMethod: string;
    createdAt: string;
    customerName: string;
  }[];
}

export interface StockSummary {
  totals: { totalSKUs: number; inStock: number; lowStock: number; outOfStock: number };
}

export interface LowStockItem {
  id: string;
  stock: number;
  reservedStock: number;
  product: { name: string };
  variant: { name: string };
  store: { name: string };
}

export function percentChange(current: number, previous: number): number | null {
  return previous > 0 ? ((current - previous) / previous) * 100 : null;
}
