import { useEffect, useState } from "react";
import { useGetIdentity } from "@refinedev/core";
import { Alert, App, Button, Card, Descriptions, Empty, Form, Input, Tag, Typography } from "antd";
import { BankOutlined } from "@ant-design/icons";
import { payoutAccountSchema } from "@martly/shared/schemas";
import { axiosInstance } from "../../providers/data-provider";
import { ReadableSection } from "../../components/ReadableSection";
import { sectionTitle } from "../../theme";
import { errorMessage, useFinanceOrg } from "./utils";
import type { PayoutAccount } from "./types";

interface FormValues { accountHolder: string; accountNumber?: string; ifsc?: string; upiVpa?: string }

export function VerificationTag({ verified }: { verified: boolean }) {
  return verified ? <Tag color="green">Verified</Tag> : <Tag color="gold">Awaiting verification</Tag>;
}

function CurrentDetails({ account }: { account: PayoutAccount }) {
  return (
    <Descriptions column={1} size="small" bordered style={{ marginBottom: 16 }}>
      <Descriptions.Item label="Account holder">{account.accountHolder}</Descriptions.Item>
      {account.accountLast4 && <Descriptions.Item label="Bank account">{`••••${account.accountLast4}`}{account.ifsc ? ` · ${account.ifsc}` : ""}</Descriptions.Item>}
      {account.upiVpa && <Descriptions.Item label="UPI">{account.upiVpa}</Descriptions.Item>}
      <Descriptions.Item label="Status"><VerificationTag verified={account.verified} /></Descriptions.Item>
    </Descriptions>
  );
}

/** Empty fields are left out so the API sees a bank account or a UPI ID, never blank strings */
const clean = (v: FormValues) => Object.fromEntries(Object.entries(v).filter(([, x]) => x)) as FormValues;

function usePayoutAccount(organizationId: string | undefined, ready: boolean) {
  const { notification } = App.useApp();
  const [account, setAccount] = useState<PayoutAccount | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!ready) return;
    axiosInstance.get("/ledger/payout-account", { params: { organizationId } })
      .then((res) => setAccount(res.data.data))
      .catch((err) => notification.error({ message: errorMessage(err, "Could not load payout details") }));
  }, [ready, organizationId, notification]);

  const save = async (raw: FormValues) => {
    const parsed = payoutAccountSchema.safeParse(clean(raw));
    if (!parsed.success) { notification.error({ message: parsed.error.issues[0].message }); return; }
    setSaving(true);
    try {
      const res = await axiosInstance.put("/ledger/payout-account", parsed.data);
      setAccount(res.data.data);
      notification.success({ message: "Payout details saved. Payouts are paused until Martly verifies them." });
    } catch (err) {
      notification.error({ message: errorMessage(err, "Could not save payout details") });
    } finally {
      setSaving(false);
    }
  };
  return { account, saving, save };
}

/** Opens with the saved details; the account number stays blank because only its last 4 digits are ever shown */
function PayoutForm({ account, saving, onSave }: { account: PayoutAccount | null; saving: boolean; onSave: (v: FormValues) => void }) {
  const initialValues = { accountHolder: account?.accountHolder, ifsc: account?.ifsc ?? undefined, upiVpa: account?.upiVpa ?? undefined };
  const keepHint = account?.accountLast4 ? `Leave blank to keep ••••${account.accountLast4}` : undefined;
  return (
    <Card size="small" title={account ? "Change details" : "Add details"}>
      <Alert type="warning" showIcon style={{ marginBottom: 16 }} message="Saving pauses payouts until Martly verifies the new details." />
      <Form layout="vertical" initialValues={initialValues} onFinish={onSave}>
        <Form.Item name="accountHolder" label="Account holder" rules={[{ required: true, message: "Enter the account holder's name" }]}><Input /></Form.Item>
        <Form.Item name="accountNumber" label="Account number" extra={keepHint}><Input inputMode="numeric" /></Form.Item>
        <Form.Item name="ifsc" label="IFSC"><Input style={{ textTransform: "uppercase" }} /></Form.Item>
        <Form.Item name="upiVpa" label="UPI ID" extra="Add a bank account with IFSC, a UPI ID, or both."><Input placeholder="name@bank" /></Form.Item>
        <Button type="primary" htmlType="submit" loading={saving}>Save payout details</Button>
      </Form>
    </Card>
  );
}

export const PayoutAccountPage = () => {
  const { data: identity } = useGetIdentity<{ role: string }>();
  const { organizationId, picker, ready } = useFinanceOrg();
  const { account, saving, save } = usePayoutAccount(organizationId, ready);

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>{sectionTitle(<BankOutlined />, "Payout account")}</h2>
        {picker}
      </div>
      {!ready ? <Empty description="Choose an organization" /> : (
        <ReadableSection>
          <Card size="small" title="Current details" style={{ marginBottom: 16 }}>
            {account ? <CurrentDetails account={account} /> : <Typography.Text type="secondary">No payout details added yet.</Typography.Text>}
          </Card>
          {identity?.role === "ORG_ADMIN" && <PayoutForm key={account?.updatedAt ?? "new"} account={account} saving={saving} onSave={save} />}
        </ReadableSection>
      )}
    </>
  );
};
