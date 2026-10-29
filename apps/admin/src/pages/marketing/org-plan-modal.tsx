import { useEffect, useState } from "react";
import { App, Button, Divider, InputNumber, Modal, Select, Space, Switch, Typography } from "antd";
import dayjs from "dayjs";
import type { GrantOrgPlanInput, OrgPlanOverridesInput } from "@martly/shared/schemas";
import { axiosInstance } from "../../providers/data-provider";
import { errorMessage } from "./utils";
import type { Subscriber } from "./types";

type Flag = keyof OrgPlanOverridesInput;

const PLAN_OPTIONS: { value: GrantOrgPlanInput["productCode"]; label: string }[] = [
  { value: "GROWTH", label: "Growth" },
  { value: "PRO", label: "Pro" },
];

const FLAGS: { key: Flag; label: string; help: string }[] = [
  { key: "webStoreAlwaysOn", label: "Always on martlyshop.in", help: "The store's web store stays on whatever plan it's on" },
  { key: "unlimitedListings", label: "Unlimited own products", help: "List own or local products without using listings" },
];

interface OrgPlanModalProps {
  org: Subscriber | null;
  onClose: () => void;
  onChanged: () => void;
}

export function OrgPlanModal({ org, onClose, onChanged }: OrgPlanModalProps) {
  const { message } = App.useApp();
  const [flags, setFlags] = useState<Record<Flag, boolean>>({ webStoreAlwaysOn: false, unlimitedListings: false });
  const [saving, setSaving] = useState<Flag>();
  const [productCode, setProductCode] = useState<GrantOrgPlanInput["productCode"]>("GROWTH");
  const [days, setDays] = useState<number | null>(365);
  const [giving, setGiving] = useState(false);

  useEffect(() => {
    if (org) setFlags({ webStoreAlwaysOn: org.webStoreAlwaysOn, unlimitedListings: org.unlimitedListings });
  }, [org]);

  const toggle = async (flag: Flag, value: boolean) => {
    setSaving(flag);
    try {
      await axiosInstance.patch(`/marketing-admin/organizations/${org?.id}`, { [flag]: value } satisfies OrgPlanOverridesInput);
      setFlags((f) => ({ ...f, [flag]: value }));
      message.success("Saved");
      onChanged();
    } catch (err) {
      message.error(errorMessage(err, "Could not save"));
    } finally {
      setSaving(undefined);
    }
  };

  const give = async () => {
    setGiving(true);
    try {
      const body: GrantOrgPlanInput = { productCode, days: days ?? 0 };
      const res = await axiosInstance.post(`/marketing-admin/organizations/${org?.id}/plan`, body);
      const { plan, endsAt } = res.data.data;
      message.success(`${plan.name} given until ${dayjs(endsAt).format("D MMM YYYY")}`);
      onChanged();
      onClose();
    } catch (err) {
      message.error(errorMessage(err, "Could not give the plan"));
    } finally {
      setGiving(false);
    }
  };

  return (
    <Modal open={!!org} title={org?.name} footer={null} onCancel={onClose} destroyOnClose>
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        {FLAGS.map((f) => (
          <Space key={f.key} align="start" size="middle">
            <Switch checked={flags[f.key]} loading={saving === f.key} onChange={(v) => toggle(f.key, v)} />
            <div>
              <div style={{ fontWeight: 600 }}>{f.label}</div>
              <Typography.Text type="secondary">{f.help}</Typography.Text>
            </div>
          </Space>
        ))}
      </Space>
      <Divider orientation="left" plain>Give a plan</Divider>
      <Space wrap>
        <Select value={productCode} options={PLAN_OPTIONS} onChange={setProductCode} style={{ width: 120 }} />
        <InputNumber min={1} max={730} value={days} onChange={setDays} addonAfter="days" />
        <Button type="primary" loading={giving} disabled={!days} onClick={give}>Give plan</Button>
      </Space>
      <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>Starts now, no payment.</Typography.Paragraph>
    </Modal>
  );
}
