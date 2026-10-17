import { useState } from "react";
import { App, Alert, Button, Popconfirm, Space } from "antd";
import { isAxiosError } from "axios";
import type { PromoDetail } from "@martly/shared/types";
import { axiosInstance } from "../../providers/data-provider";
import { createPromo, discountLabel } from "./promo-utils";

const LAUNCH_TIMEOUT_MS = 60000;

export function useAction(onDone: () => void) {
  const { message } = App.useApp();
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (key: string, call: () => Promise<unknown>, success: string, failure: string) => {
    setBusy(key);
    try {
      await call();
      message.success(success);
      onDone();
    } catch (err) {
      if (!isAxiosError(err)) throw err;
      message.error(err.response?.data?.message ?? failure);
    } finally {
      setBusy(null);
    }
  };
  return { busy, run };
}

type Run = ReturnType<typeof useAction>["run"];

function launchSummary(promo: PromoDetail): string {
  const discount = promo.discountType ? `${discountLabel(promo.discountType, promo.discountValue)} on ${promo.productCount} products` : "No discount";
  return `${discount}. ${promo.notify ? "A push goes to customers." : "No push."}`;
}

/** Delete is offered in every state but drafting; a live promotion is ended first so prices go back */
function DeleteButton({ promo, busy, run, onDeleted }: { promo: PromoDetail; busy: string | null; run: Run; onDeleted: () => void }) {
  if (promo.status === "DRAFTING" || promo.chargedFrom === "BRAND") return null;
  const description = promo.status === "LIVE" ? "It ends now (prices go back), then its banner and results are removed." : "Its banner and results are removed.";
  return (
    <Popconfirm title="Delete this promotion?" description={description} okText="Delete" okButtonProps={{ danger: true }}
      onConfirm={() => run("delete", async () => { await axiosInstance.delete(`/promos/${promo.id}`); onDeleted(); }, "Promotion deleted", "Could not delete")}>
      <Button danger loading={busy === "delete"}>Delete</Button>
    </Popconfirm>
  );
}

function StatusAction({ promo, busy, run, onRetried }: { promo: PromoDetail; busy: string | null; run: Run; onRetried: (id: string) => void }) {
  if (promo.status === "READY") {
    return (
      <>
        <Popconfirm title="Launch this promo?" description={launchSummary(promo)} okText="Launch" onConfirm={() => run("launch", () => axiosInstance.post(`/promos/${promo.id}/launch`, null, { timeout: LAUNCH_TIMEOUT_MS }), "Promo is live", "Could not launch")}>
          <Button type="primary" loading={busy === "launch"}>Launch</Button>
        </Popconfirm>
        {promo.kind === "AI" && promo.redraftsLeft > 0 && (
          <Button loading={busy === "redraft"} onClick={() => run("redraft", () => axiosInstance.post(`/promos/${promo.id}/regenerate`), "Drafting again", "Could not redraft")}>
            Redraft ({promo.redraftsLeft} free {promo.redraftsLeft === 1 ? "redraft" : "redrafts"} left)
          </Button>
        )}
      </>
    );
  }
  if (promo.status === "LIVE") {
    return (
      <Popconfirm title="End this promo now?" description="Removes the banner and restores prices" okText="End now" okButtonProps={{ danger: true }} onConfirm={() => run("end", () => axiosInstance.post(`/promos/${promo.id}/end`), "Promo ended", "Could not end the promo")}>
        <Button danger loading={busy === "end"}>End now</Button>
      </Popconfirm>
    );
  }
  if (promo.status === "ENDED") {
    return (
      <Popconfirm title="Use this promo again?" description="It goes back to Ready with the same banner and products; launch it for a fresh window." okText="Use again" onConfirm={() => run("reopen", () => axiosInstance.post(`/promos/${promo.id}/reopen`), "Ready to launch again", "Could not reopen the promo")}>
        <Button type="primary" loading={busy === "reopen"}>Use again</Button>
      </Popconfirm>
    );
  }
  if (promo.status === "FAILED") {
    const retry = () => run("retry", async () => onRetried(await createPromo({ brief: promo.brief, autoLaunch: promo.autoLaunch, notify: promo.notify })), "Drafting again", "Could not retry");
    return <Button type="primary" loading={busy === "retry"} onClick={retry}>Try again</Button>;
  }
  return null;
}

export function PromoActions({ promo, busy, run, onDeleted, onRetried }: {
  promo: PromoDetail;
  busy: string | null;
  run: Run;
  onDeleted: () => void;
  onRetried: (id: string) => void;
}) {
  return (
    <Space direction="vertical" style={{ width: "100%" }}>
      {promo.status === "FAILED" && <Alert type="error" showIcon message="Drafting failed" description={promo.failureReason ?? "Unknown error"} />}
      <Space>
        <StatusAction promo={promo} busy={busy} run={run} onRetried={onRetried} />
        <DeleteButton promo={promo} busy={busy} run={run} onDeleted={onDeleted} />
      </Space>
    </Space>
  );
}
