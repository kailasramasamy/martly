import { isAxiosError } from "axios";
import { useEffect, useState } from "react";
import { App, Button, Form, Input, Modal, Popconfirm, Space } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import { axiosInstance } from "../../providers/data-provider";
import { payWithRazorpay } from "../../components/RazorpayPay";
import { BillingModal } from "../marketing/billing-form";
import type { BillingProfile, BillingValues } from "../marketing/types";
import { errorMessage } from "../marketing/utils";
import { useAction } from "../promos/promo-actions";
import type { Campaign, CampaignScope } from "./types";

interface ActionsProps {
  campaign: Campaign;
  scope: CampaignScope;
  onChange: (campaign: Campaign) => void;
}

type Dialog = "bank" | "pay" | "reject" | null;

/** Posts to a campaign action endpoint and hands the refreshed campaign back */
function useCampaignCall(scope: CampaignScope, campaign: Campaign, onChange: (c: Campaign) => void) {
  const { busy, run } = useAction(() => undefined);
  const call = (key: string, action: string, body: object | null, success: string, timeout?: number) =>
    run(key, async () => {
      const res = await axiosInstance.post(`${scope.apiBase}/${campaign.id}/${action}`, body, { timeout });
      onChange(res.data.data);
    }, success, "That did not work");
  return { busy, call, run };
}

function RejectModal({ open, onClose, onReject }: { open: boolean; onClose: () => void; onReject: (note: string) => Promise<void> }) {
  const [note, setNote] = useState("");
  return (
    <Modal open={open} title="Reject this campaign" okText="Reject" okButtonProps={{ danger: true }} onCancel={onClose} onOk={() => onReject(note).then(onClose)}>
      <Input.TextArea rows={3} maxLength={400} placeholder="Tell the brand why (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
    </Modal>
  );
}

// Filled from the brand's last invoice (else just its name), so recording a transfer usually needs only the reference
function BankModal({ open, scope, campaign, onClose, onRecord }: { open: boolean; scope: CampaignScope; campaign: Campaign; onClose: () => void; onRecord: (v: BillingValues & { reference: string }) => Promise<void> }) {
  const [profile, setProfile] = useState<BillingProfile | null>(null);
  useEffect(() => {
    if (!open) {
      setProfile(null);
      return;
    }
    const fallback = { billingName: campaign.brand.name, gstin: null, billingAddress: null, billingState: null };
    axiosInstance.get(`${scope.apiBase}/${campaign.id}/billing`)
      .then((res) => setProfile(res.data.data ?? fallback))
      .catch((err) => {
        if (!isAxiosError(err)) throw err;
        setProfile(fallback);
      });
  }, [open, scope.apiBase, campaign.id, campaign.brand.name]);
  return (
    <BillingModal<BillingValues & { reference: string }>
      open={open && profile !== null}
      title="Record bank transfer"
      okText="Mark as paid"
      profile={profile}
      extra={<Form.Item name="reference" label="Bank reference" rules={[{ required: true, min: 3 }]}><Input maxLength={120} /></Form.Item>}
      onSubmit={async (v) => { await onRecord(v); onClose(); }}
      onClose={onClose}
    />
  );
}

function PayModal({ open, scope, campaign, onClose, onPaid }: { open: boolean; scope: CampaignScope; campaign: Campaign; onClose: () => void; onPaid: (c: Campaign) => void }) {
  const { notification } = App.useApp();
  const [profile, setProfile] = useState<BillingProfile | null>(null);

  useEffect(() => {
    if (open) axiosInstance.get("/brand-portal/billing").then((res) => setProfile(res.data.data));
  }, [open]);

  const pay = async (values: BillingValues) => {
    try {
      const order = (await axiosInstance.post(`${scope.apiBase}/${campaign.id}/checkout`, values)).data.data;
      const payment = await payWithRazorpay(order.checkout, campaign.title);
      const res = await axiosInstance.post(`${scope.apiBase}/${campaign.id}/verify`, payment);
      onPaid(res.data.data);
      onClose();
      notification.success({ message: "Payment received", description: "Your campaign is now in review." });
    } catch (err) {
      notification.error({ message: errorMessage(err, "Could not complete the payment") });
    }
  };
  return <BillingModal open={open} title="Pay for this campaign" okText="Continue to payment" profile={profile} onSubmit={pay} onClose={onClose} />;
}

async function downloadClaims(scope: CampaignScope, campaign: Campaign) {
  const res = await axiosInstance.get(`${scope.apiBase}/${campaign.id}/claims.csv`, { responseType: "blob" });
  const url = URL.createObjectURL(res.data);
  const link = Object.assign(document.createElement("a"), { href: url, download: `claims-${campaign.id.slice(0, 8)}.csv` });
  link.click();
  URL.revokeObjectURL(url);
}

const cancelButton = (campaign: Campaign, busy: string | null, call: ReturnType<typeof useCampaignCall>["call"]) => (
  <Popconfirm title="Cancel this campaign?" description={campaign.adOrder?.status === "PAID" ? "The payment is refunded." : undefined} okText="Cancel campaign" okButtonProps={{ danger: true }} onConfirm={() => call("cancel", "cancel", null, "Campaign cancelled")}>
    <Button danger loading={busy === "cancel"}>Cancel</Button>
  </Popconfirm>
);

function StatusButtons({ campaign, scope, busy, call, open }: { campaign: Campaign; scope: CampaignScope; busy: string | null; call: ReturnType<typeof useCampaignCall>["call"]; open: (d: Dialog) => void }) {
  const platform = scope.mode === "platform";
  const cancel = platform ? cancelButton(campaign, busy, call) : null;
  switch (campaign.status) {
    case "PENDING_PAYMENT":
      return <Space>{platform ? <Button type="primary" onClick={() => open("bank")}>Record bank transfer</Button> : <Button type="primary" onClick={() => open("pay")}>Pay now</Button>}{cancel}</Space>;
    case "IN_REVIEW":
      return (
        <Space>
          {platform && <Popconfirm title="Approve this campaign?" okText="Approve" onConfirm={() => call("approve", "review", { approve: true }, "Campaign approved")}><Button type="primary" loading={busy === "approve"}>Approve</Button></Popconfirm>}
          {platform && <Button danger onClick={() => open("reject")}>Reject</Button>}
          {cancel}
        </Space>
      );
    case "SCHEDULED":
      return cancel;
    case "LIVE":
      return platform ? <Popconfirm title="End this campaign now?" okText="End now" okButtonProps={{ danger: true }} onConfirm={() => call("end", "end", null, "Campaign ended")}><Button danger loading={busy === "end"}>End now</Button></Popconfirm> : null;
    default:
      return null;
  }
}

export function CampaignActions({ campaign, scope, onChange }: ActionsProps) {
  const { busy, call, run } = useCampaignCall(scope, campaign, onChange);
  const [dialog, setDialog] = useState<Dialog>(null);
  const close = () => setDialog(null);
  const claims = campaign.product.kind === "BRAND_PROMOTION" && (campaign.status === "LIVE" || campaign.status === "ENDED");
  const record = (v: BillingValues & { reference: string }) => call("bank", "mark-paid", v, "Payment recorded");
  const reject = (note: string) => call("reject", "review", { approve: false, note: note || undefined }, "Campaign rejected");

  return (
    <Space wrap>
      {claims && (
        <Button icon={<DownloadOutlined />} loading={busy === "claims"} onClick={() => void run("claims", () => downloadClaims(scope, campaign), "Claims downloaded", "Could not download the claims")}>
          Download claims (CSV)
        </Button>
      )}
      <StatusButtons campaign={campaign} scope={scope} busy={busy} call={call} open={setDialog} />
      <BankModal open={dialog === "bank"} scope={scope} campaign={campaign} onClose={close} onRecord={record} />
      <PayModal open={dialog === "pay"} scope={scope} campaign={campaign} onClose={close} onPaid={onChange} />
      <RejectModal open={dialog === "reject"} onClose={close} onReject={reject} />
    </Space>
  );
}
