import { useState } from "react";
import { App } from "antd";
import { axiosInstance } from "../../providers/data-provider";
import { errorMessage } from "./utils";

type PlanAction = "cancel";

const ENDPOINTS: Record<PlanAction, string> = { cancel: "/marketing/subscription/cancel" };
const SUCCESS: Record<PlanAction, string> = {
  cancel: "Auto-renew is off. Your plan stays active until the end of the paid month.",
};

/** Owner actions on the plan that need no payment: turning auto-renew off */
export function usePlanActions(onDone: () => Promise<void>) {
  const { notification } = App.useApp();
  const [acting, setActing] = useState<PlanAction | null>(null);

  const run = async (action: PlanAction) => {
    setActing(action);
    try {
      await axiosInstance.post(ENDPOINTS[action]);
      await onDone();
      notification.success({ message: SUCCESS[action] });
    } catch (err) {
      notification.error({ message: errorMessage(err, "Could not update your plan") });
    } finally {
      setActing(null);
    }
  };

  return { acting, cancelRenewal: () => run("cancel") };
}
