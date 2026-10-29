import { useEffect, useState } from "react";
import { Alert, Col, DatePicker, Form, Input, InputNumber, Row, Select, Statistic, Switch, message } from "antd";
import type { FormInstance } from "antd";
import { useGetIdentity, useNavigation } from "@refinedev/core";
import dayjs from "dayjs";
import { CREDIT_DEFAULTS, MARTLY_CREDIT_FUNDER as MARTLY, STORE_CREDIT_MAX_AMOUNT } from "@martly/shared/constants";
import type { CreditCampaignRow } from "@martly/shared/types";
import { axiosInstance } from "../../providers/data-provider";
import { usePickLoneStore } from "../../components/StoreSelect";
import { inr } from "./format";

const RUPEE = "₹";

interface FormValues {
  funder?: string;
  amount: number;
  minOrderAmount: number;
  validDays: number;
  budget: number;
  headline?: string;
  message?: string;
  taHeadline?: string;
  taMessage?: string;
  isActive: boolean;
  startsAt?: dayjs.Dayjs;
  endsAt?: dayjs.Dayjs | null;
}

function toPayload(v: FormValues, creating: boolean) {
  const ta = { headline: v.taHeadline || undefined, message: v.taMessage || undefined };
  return {
    ...(creating && { storeId: v.funder === MARTLY ? null : v.funder }),
    amount: v.amount,
    minOrderAmount: v.minOrderAmount,
    validDays: v.validDays,
    budget: v.budget,
    headline: v.headline || null,
    message: v.message || null,
    translations: ta.headline || ta.message ? { ta } : null,
    isActive: v.isActive,
    startsAt: v.startsAt?.toISOString(),
    endsAt: v.endsAt ? v.endsAt.toISOString() : null,
  };
}

function toValues(r: CreditCampaignRow): FormValues {
  return {
    ...r,
    headline: r.headline ?? undefined,
    message: r.message ?? undefined,
    taHeadline: r.translations?.ta?.headline,
    taMessage: r.translations?.ta?.message,
    startsAt: dayjs(r.startsAt),
    endsAt: r.endsAt ? dayjs(r.endsAt) : null,
  };
}

/** Saves the campaign form: a new one when there is no record, otherwise a change that applies to credit given from now on */
export function useCampaignSave(form: FormInstance<FormValues>, record?: CreditCampaignRow) {
  const [saving, setSaving] = useState(false);
  const { list } = useNavigation();

  const save = async () => {
    const values = await form.validateFields();
    setSaving(true);
    const body = toPayload(values, !record);
    const request = record
      ? axiosInstance.patch(`/credits/campaigns/${record.id}`, body)
      : axiosInstance.post("/credits/campaigns", body);
    request
      .then(() => {
        message.success(record ? "Welcome credit updated" : "Welcome credit started");
        list("welcome-credit");
      })
      .catch((err) => message.error(err.response?.data?.message ?? "Couldn't save the welcome credit"))
      .finally(() => setSaving(false));
  };

  return { saving, save };
}

function useStoreOptions() {
  const [options, setOptions] = useState<{ label: string; value: string }[]>([]);
  useEffect(() => {
    axiosInstance
      .get("/stores", { params: { pageSize: 100 } })
      .then((res) => setOptions(res.data.data.map((s: { id: string; name: string }) => ({ label: s.name, value: s.id }))))
      .catch((err) => message.error(err.response?.data?.message ?? "Couldn't load your stores"));
  }, []);
  return options;
}

function UsageSummary({ record }: { record: CreditCampaignRow }) {
  const u = record.usage;
  return (
    <>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}><Statistic title="Budget" value={inr(record.budget)} /></Col>
        <Col xs={12} md={6}><Statistic title="Spent" value={inr(u.spent)} /></Col>
        <Col xs={12} md={6}><Statistic title="Reserved" value={inr(u.reserved)} /></Col>
        <Col xs={12} md={6}><Statistic title="Outstanding" value={inr(u.outstanding)} /></Col>
      </Row>
      <Alert type="info" showIcon style={{ marginBottom: 24 }}
        message="Changes only affect credit given from now on. Credit already given keeps its amount and expiry." />
    </>
  );
}

function TermsFields({ capped }: { capped: boolean }) {
  return (
    <>
    <Row gutter={16}>
      <Col xs={24} md={8}>
        <Form.Item label="Credit per new customer" name="amount" rules={[
          { required: true },
          { type: "number", min: 1 },
          { type: "number", max: capped ? STORE_CREDIT_MAX_AMOUNT : 10000, message: `A store can give at most ${RUPEE}${STORE_CREDIT_MAX_AMOUNT}` },
        ]}>
          <InputNumber style={{ width: "100%" }} prefix={RUPEE} />
        </Form.Item>
      </Col>
      <Col xs={24} md={8}>
        <Form.Item label="Minimum order" name="minOrderAmount" dependencies={["amount"]} rules={[
          { required: true },
          ({ getFieldValue }) => ({
            validator: (_, v: number | undefined) =>
              v == null || v >= (getFieldValue("amount") ?? 0)
                ? Promise.resolve()
                : Promise.reject(new Error("Minimum order must be at least the credit amount")),
          }),
        ]}>
          <InputNumber min={0} style={{ width: "100%" }} prefix={RUPEE} />
        </Form.Item>
      </Col>
      <Col xs={24} md={8}>
        <Form.Item label="Valid for (days)" name="validDays" rules={[{ required: true }]} extra="1 to 90 days from when it is given">
          <InputNumber min={1} max={90} precision={0} style={{ width: "100%" }} />
        </Form.Item>
      </Col>
    </Row>

    <Form.Item label="Budget" name="budget" rules={[{ required: true, message: "Set the most you will spend" }]}
      extra="Counted when an order using the credit is placed or delivered. Credit already given can still be used after the budget is reached.">
      <InputNumber min={1} style={{ width: "100%" }} prefix={RUPEE} />
    </Form.Item>
    </>
  );
}

function CopyFields() {
  return (
    <Row gutter={16}>
      <Col xs={24} md={12}>
        <Form.Item label="Headline" name="headline" rules={[{ max: 60 }]}
          extra={`Optional. The app writes "${RUPEE}50 free on your first order" when blank`}>
          <Input maxLength={60} />
        </Form.Item>
        <Form.Item label="Message" name="message" rules={[{ max: 200 }]}>
          <Input.TextArea maxLength={200} rows={2} />
        </Form.Item>
      </Col>
      <Col xs={24} md={12}>
        <Form.Item label="Headline in Tamil" name="taHeadline" rules={[{ max: 60 }]}>
          <Input maxLength={60} />
        </Form.Item>
        <Form.Item label="Message in Tamil" name="taMessage" rules={[{ max: 200 }]}>
          <Input.TextArea maxLength={200} rows={2} />
        </Form.Item>
      </Col>
    </Row>
  );
}

function ScheduleFields() {
  return (
    <Row gutter={16}>
      <Col xs={24} md={8}>
        <Form.Item label="Starts" name="startsAt">
          <DatePicker showTime style={{ width: "100%" }} />
        </Form.Item>
      </Col>
      <Col xs={24} md={8}>
        <Form.Item label="Ends" name="endsAt" extra="Leave empty to run until the budget is used">
          <DatePicker showTime style={{ width: "100%" }} />
        </Form.Item>
      </Col>
      <Col xs={24} md={8}>
        <Form.Item label="Active" name="isActive" valuePropName="checked">
          <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
        </Form.Item>
      </Col>
    </Row>
  );
}

interface CampaignFormProps {
  form: FormInstance<FormValues>;
  record?: CreditCampaignRow;
}

export function CampaignForm({ form, record }: CampaignFormProps) {
  const { data: identity } = useGetIdentity<{ role: string }>();
  const isSuperAdmin = identity?.role === "SUPER_ADMIN";
  const stores = useStoreOptions();
  const funder = Form.useWatch("funder", form);

  usePickLoneStore(isSuperAdmin ? [] : stores.map((s) => s.value), funder, (id) => form.setFieldValue("funder", id));

  const funderOptions = isSuperAdmin ? [{ label: "Martly (all stores)", value: MARTLY }, ...stores] : stores;
  const capped = !isSuperAdmin && funder !== MARTLY;

  return (
    <>
      {record && <UsageSummary record={record} />}
      <Form form={form} layout="vertical"
        initialValues={record ? toValues(record) : { ...CREDIT_DEFAULTS, isActive: true, startsAt: dayjs() }}>
        {record ? (
          <Form.Item label="Funded by"><Input disabled value={record.storeName ?? "Martly"} /></Form.Item>
        ) : (
          <Form.Item label="Funded by" name="funder" rules={[{ required: true, message: "Choose who pays for it" }]}>
            <Select showSearch optionFilterProp="label" placeholder="Select who pays" options={funderOptions} />
          </Form.Item>
        )}

        <TermsFields capped={capped} />
        <CopyFields />
        <ScheduleFields />
      </Form>
    </>
  );
}
