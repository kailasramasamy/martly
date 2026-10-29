import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";

/** Owner actions on the marketing plan that need no payment: turning auto-renew off */
export function usePlanActions(onChanged: () => void) {
  const { run, running } = useAction();

  const post = async (path: string, message: string) => {
    const done = await run(() => api.post(path, {}), message);
    if (done) onChanged();
    return !!done;
  };

  return {
    running,
    cancelRenewal: () => post("/api/v1/marketing/subscription/cancel", "Auto-renew is off"),
  };
}
