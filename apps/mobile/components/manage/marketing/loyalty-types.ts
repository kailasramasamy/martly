export interface LoyaltyConfig {
  id: string;
  isEnabled: boolean;
  earnRate: number;
  minRedeemPoints: number;
  maxRedeemPercentage: number;
  reviewRewardPoints: number;
}

export interface LoyaltyBalance {
  id: string;
  userId: string;
  points: number;
  totalEarned: number;
  totalRedeemed: number;
  user: { id: string; name: string | null; email: string | null; phone: string | null };
}

export interface LoyaltyTransaction {
  id: string;
  type: "EARN" | "REDEEM" | "REVERSAL" | "ADJUSTMENT";
  points: number;
  balanceAfter: number;
  description: string | null;
  createdAt: string;
}

export interface ReferralConfig {
  id: string;
  isEnabled: boolean;
  referrerReward: string | number;
  refereeReward: string | number;
  maxReferralsPerUser: number;
}

export interface ReferralItem {
  id: string;
  referrer: { id: string; name: string | null; email: string | null; referralCode: string | null };
  referee: { id: string; name: string | null; email: string | null };
  status: "PENDING" | "COMPLETED" | "EXPIRED";
  referrerReward: string | number;
  refereeReward: string | number;
  completedAt: string | null;
  createdAt: string;
}

export interface ReferralStats {
  totalReferrals: number;
  pendingReferrals: number;
  completedReferrals: number;
  totalRewardsGiven: number;
  conversionRate: number;
}

export interface MembershipPlan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration: "MONTHLY" | "QUARTERLY" | "ANNUAL";
  freeDelivery: boolean;
  loyaltyMultiplier: string | number;
  isActive: boolean;
  sortOrder: number;
  organization?: { name: string } | null;
}

export interface MembershipSubscriber {
  id: string;
  status: "ACTIVE" | "EXPIRED" | "CANCELLED";
  startDate: string;
  endDate: string;
  pricePaid: number;
  user: { id: string; name: string | null; email: string | null; phone: string | null };
  plan: { name: string; duration: MembershipPlan["duration"] };
}
