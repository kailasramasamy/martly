import { NotificationType } from "@martly/shared/constants";

export interface StaffNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, string> | null;
  isRead: boolean;
  createdAt: string;
}

/** Admin route for a staff notification's `data.screen`; undefined when the admin has no matching page */
export function notificationRoute(data: Record<string, string> | null): string | undefined {
  if (!data?.screen) return undefined;
  const { screen, orderId, returnRequestId, ticketId, campaignId, promoId, countId, draftId } = data;
  switch (screen) {
    case "manage-order": return orderId ? `/orders/show/${orderId}` : "/orders";
    case "manage-orders": return "/orders";
    case "trip": return "/delivery-board";
    case "delivery-slots": return "/delivery-slots";
    case "manage-return": return returnRequestId ? `/return-requests/show/${returnRequestId}` : "/return-requests";
    case "manage-ticket": return ticketId ? `/support-tickets/show/${ticketId}` : "/support-tickets";
    case "manage-reviews": return "/reviews";
    case "store-ratings": return "/store-ratings";
    case "stock": return "/stock";
    case "stock-count": return countId ? `/stock-counts/${countId}` : "/stock-counts";
    case "catalog-draft": return draftId ? `/catalog-drafts/show/${draftId}` : "/catalog-drafts";
    case "promo": return promoId ? `/promos/show/${promoId}` : "/promos";
    case "campaign": return campaignId ? `/notifications/campaigns/show/${campaignId}` : "/notifications/campaigns";
    case "brand-ads": return "/brand-campaigns";
    case "marketing-plan": return "/marketing-plan";
    case "manage-subscriptions": return "/subscriptions";
    case "manage-finance":
    case "manage-ledger-entry": return "/ledger";
    case "manage-settlement": return "/settlements";
    case "manage-payout-account": return "/payout-account";
    case "manage-profile": return "/profile";
    default: return undefined;
  }
}

/** Short two-tone beep via Web Audio; needs no asset. Silently skipped until the browser allows audio */
export function playBeep() {
  const AudioCtx = window.AudioContext;
  if (!AudioCtx) return;
  const ctx = new AudioCtx();
  const start = ctx.currentTime;
  [880, 1175].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t = start + i * 0.18;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.17);
  });
  setTimeout(() => void ctx.close(), 600);
}

export const IS_NEW_ORDER = (type: string) => type === NotificationType.NEW_ORDER;
