export type NotificationTab = "send" | "campaigns" | "templates" | "dashboard";

export const NOTIFICATION_TABS: { value: NotificationTab; label: string }[] = [
  { value: "send", label: "Send" },
  { value: "campaigns", label: "Campaigns" },
  { value: "templates", label: "Templates" },
  { value: "dashboard", label: "Dashboard" },
];

export interface Campaign {
  id: string;
  title: string;
  body: string;
  type: string;
  imageUrl: string | null;
  audienceType: string;
  audienceConfig: Record<string, unknown> | null;
  status: string;
  recipientCount: number;
  readCount: number;
  readRate: number;
  sentAt: string | null;
  scheduledAt: string | null;
  createdAt: string;
  sentByUser: { name: string; email?: string } | null;
  _count?: { notifications: number };
}

export interface Template {
  id: string;
  name: string;
  title: string;
  body: string;
  type: string;
  imageUrl: string | null;
  createdAt: string;
  creator: { name: string } | null;
}

export interface NotificationStats {
  kpis: { campaignsSent: number; notificationsDelivered: number; readRate: number; avgRecipients: number };
  dailyStats: { date: string; campaigns: number; notifications: number }[];
  byType: { type: string; count: number; notifications: number }[];
  topCampaigns: { id: string; title: string; type: string; recipientCount: number; readCount: number; readRate: number }[];
  recentCampaigns: { id: string; title: string; type: string; status: string; recipientCount: number; sentAt: string | null; createdAt: string }[];
}

export interface AudienceConfig {
  storeId?: string;
  days?: number;
  minAmount?: number;
}

export const TYPE_OPTIONS = [
  { value: "PROMOTIONAL", label: "Promotional" },
  { value: "GENERAL", label: "General" },
];
