import { App } from "antd";
import { useGetIdentity } from "@refinedev/core";
import { isAxiosError } from "axios";
import { Link } from "react-router";
import { useEntitlements } from "../../hooks/use-entitlements";

/** Org users' plan usage; the platform admin has no organisation and no limits */
export function usePromoEntitlements() {
  const { data: identity } = useGetIdentity<{ role: string }>();
  const isOrgUser = !!identity && identity.role !== "SUPER_ADMIN";
  return { isOrgUser, isPlatform: identity?.role === "SUPER_ADMIN", ...useEntitlements(isOrgUser) };
}

/** Shows a save failure; a full plan (402) links to the Marketing plan page */
export function useNotifyPromoError(fallback: string) {
  const { notification } = App.useApp();
  return (error: unknown) => {
    if (!isAxiosError(error)) throw error;
    notification.error({
      message: error.response?.data?.message ?? fallback,
      description: error.response?.status === 402 ? <Link to="/marketing-plan">Open Marketing plan</Link> : undefined,
    });
  };
}
