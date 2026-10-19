import { useEffect, useState } from "react";
import { Button, Card, Form, Input } from "antd";
import { RocketOutlined } from "@ant-design/icons";
import { useGetIdentity, useNavigation } from "@refinedev/core";
import type { Dayjs } from "dayjs";
import type { Entitlements } from "../../marketing/types";
import { axiosInstance } from "../../../providers/data-provider";
import { BannerImageCard } from "../image-card";
import { useCategoryTree, withCategoryTarget } from "../category-target";
import { useNotifyPromoError } from "../promo-access";
import { OrganizationField } from "../create-card";
import { NotifyField, ScheduleFields } from "./schedule-fields";
import { DiscountFields, TargetFields } from "./target-fields";

interface ManualValues {
  title: string;
  subtitle?: string;
  actionType: string;
  actionTarget?: string;
  discountType: "NONE" | "PERCENTAGE" | "FLAT";
  discountValue?: number;
  durationDays: number;
  startMode: "NOW" | "READY" | "SCHEDULE";
  launchAt?: Dayjs;
  notify: boolean;
  organizationId?: string;
  imageUrl: string;
  textInImage: boolean;
}

const INITIAL_VALUES = {
  actionType: "CATEGORY",
  discountType: "NONE",
  durationDays: 7,
  startMode: "READY",
  notify: false,
  textInImage: true,
};

function toRequestBody(values: ManualValues) {
  const { startMode, launchAt, discountType, discountValue, ...rest } = values;
  const discounted = discountType !== "NONE";
  return {
    ...rest,
    discountType: discounted ? discountType : undefined,
    discountValue: discounted ? discountValue : undefined,
    launchNow: startMode === "NOW",
    launchAt: startMode === "SCHEDULE" ? launchAt?.toISOString() : undefined,
  };
}

interface Props {
  entitlements: Entitlements | null;
  isOrgUser: boolean;
  noAllowance: boolean;
}

export function ManualPromoForm({ entitlements, isOrgUser, noAllowance }: Props) {
  const [form] = Form.useForm<ManualValues>();
  const { show } = useNavigation();
  const { data: identity } = useGetIdentity<{ role: string }>();
  const tree = useCategoryTree();
  const notifyError = useNotifyPromoError("Could not create the promotion");
  const [saving, setSaving] = useState(false);
  const pushAllowed = !isOrgUser || !!entitlements?.pushIncluded;

  useEffect(() => {
    if (identity && !pushAllowed) form.setFieldValue("notify", false);
  }, [identity, pushAllowed, form]);

  const submit = async (values: ManualValues) => {
    setSaving(true);
    try {
      const body = withCategoryTarget(toRequestBody(values) as Record<string, unknown>);
      const res = await axiosInstance.post("/promos/manual", body);
      show("promos", res.data.data.id);
    } catch (err) {
      notifyError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Form form={form} layout="vertical" initialValues={INITIAL_VALUES} onFinish={submit}>
      <Card title="Promotion" size="small" style={{ marginBottom: 16 }}>
        {identity?.role === "SUPER_ADMIN" && <OrganizationField />}
        <Form.Item name="title" label="Title" rules={[{ required: true, min: 2, whitespace: true, message: "Enter at least 2 characters" }]}>
          <Input maxLength={60} showCount />
        </Form.Item>
        <Form.Item name="subtitle" label="Subtitle">
          <Input maxLength={90} showCount />
        </Form.Item>
        <TargetFields tree={tree} />
        <DiscountFields />
        <ScheduleFields />
        <NotifyField pushAllowed={pushAllowed} />
      </Card>
      <BannerImageCard form={form} />
      <Button type="primary" htmlType="submit" icon={<RocketOutlined />} loading={saving} disabled={noAllowance}>Create promotion</Button>
    </Form>
  );
}
