import { useEffect, useState } from "react";
import { Alert, Button, Card, Form, Input } from "antd";
import { RocketOutlined } from "@ant-design/icons";
import { useGetIdentity, useNavigation } from "@refinedev/core";
import type { Dayjs } from "dayjs";
import { axiosInstance } from "../../../providers/data-provider";
import { useBannerEntitlements, useNotifyBannerError } from "../../banners/banner-shared";
import { useCategoryTree, withCategoryTarget } from "../../banners/category-target";
import { OrganizationField } from "../create-card";
import { toBannerBody, type BannerFormValues } from "./banner-payload";
import { ManualBanners } from "./banners-list";
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
  banners: BannerFormValues[];
}

const INITIAL_VALUES = {
  actionType: "CATEGORY",
  discountType: "NONE",
  durationDays: 7,
  startMode: "READY",
  notify: false,
  banners: [{ textInImage: true }],
};

function toRequestBody(values: ManualValues) {
  const { startMode, launchAt, discountType, discountValue, banners, ...rest } = values;
  const discounted = discountType !== "NONE";
  return {
    ...rest,
    discountType: discounted ? discountType : undefined,
    discountValue: discounted ? discountValue : undefined,
    launchNow: startMode === "NOW",
    launchAt: startMode === "SCHEDULE" ? launchAt?.toISOString() : undefined,
    banners: banners.map(toBannerBody),
  };
}

export function ManualPromoForm() {
  const [form] = Form.useForm<ManualValues>();
  const { show } = useNavigation();
  const { data: identity } = useGetIdentity<{ role: string }>();
  const { isOrgUser, entitlements } = useBannerEntitlements();
  const tree = useCategoryTree();
  const notifyError = useNotifyBannerError("Could not create the promotion");
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
      {isOrgUser && <Alert type="info" showIcon style={{ marginBottom: 16 }} message="Manual promotions use no promotion credit" />}
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
      <Card title="Banners" size="small" style={{ marginBottom: 16 }}>
        <ManualBanners form={form} tree={tree} aiImages={isOrgUser ? entitlements?.aiImages : undefined} slots={isOrgUser ? entitlements?.bannerSlots : undefined} />
      </Card>
      <Button type="primary" htmlType="submit" icon={<RocketOutlined />} loading={saving}>Create promotion</Button>
    </Form>
  );
}
