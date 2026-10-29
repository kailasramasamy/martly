import { useRef, useState } from "react";
import { Create, useForm, useSelect } from "@refinedev/antd";
import { useNavigation } from "@refinedev/core";
import { App, Form, Input, InputNumber, Select, Switch, Card, Row, Col, DatePicker, Checkbox, Typography } from "antd";
import type { FormInstance } from "antd";
import { isAxiosError } from "axios";
import { CollectionKindLabels, EDITABLE_COLLECTION_KINDS } from "@martly/shared/constants";
import { toSchedulePayload } from "./schedule";
import { AppstoreOutlined } from "@ant-design/icons";
import { ImageUpload } from "../../components/ImageUpload";
import { sectionTitle } from "../../theme";
import { ReadableSection } from "../../components/ReadableSection";
import { axiosInstance } from "../../providers/data-provider";
import { isAiImagesExhausted } from "../../components/ai-images/exhausted";
import { AiBuilderCard, type DraftProduct } from "./ai-builder-card";

type CreateValues = Record<string, unknown> & { titleTa?: string; subtitleTa?: string; generateBanner?: boolean };

// The Tamil lines ride in translations; the banner choice stays in the form
function toPayload({ titleTa, subtitleTa, generateBanner: _banner, ...values }: CreateValues) {
  const translations = titleTa?.trim() ? { ta: { title: titleTa.trim(), subtitle: subtitleTa?.trim() || undefined } } : undefined;
  return toSchedulePayload({ ...values, translations });
}

// Shown once an AI draft has set the banner's art direction
function BannerOption({ form }: { form: FormInstance }) {
  const artDirection = Form.useWatch("artDirection", form) as string | undefined;
  if (!artDirection) return null;
  return (
    <Form.Item label="Banner" extra={<Typography.Text type="secondary">Art direction: {artDirection}</Typography.Text>}>
      <Form.Item name="generateBanner" valuePropName="checked" initialValue noStyle>
        <Checkbox>Draw the banner when I save</Checkbox>
      </Form.Item>
    </Form.Item>
  );
}

// Draws the new collection's banner, then opens it; a failed drawing still lands on the saved collection
function useBannerAfterCreate() {
  const { message } = App.useApp();
  const { edit } = useNavigation();
  return async (id: string, draw: boolean) => {
    if (draw) {
      message.loading({ content: "Drawing the banner, 1–3 minutes…", key: "banner", duration: 0 });
      try {
        await axiosInstance.post(`/collections/${id}/regenerate-banner`, undefined, { timeout: 240000 });
        message.success({ content: "Banner drawn", key: "banner" });
      } catch (err) {
        if (isAiImagesExhausted(err)) message.warning({ content: err.response?.data.message, key: "banner" });
        else if (!isAxiosError(err)) throw err;
        else message.error({ content: err.response?.data?.message ?? "The banner couldn't be drawn; regenerate it from the Banner card", key: "banner" });
      }
    }
    edit("collections", id);
  };
}

function DetailsCard({ onTitleChange }: { onTitleChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <Card title={sectionTitle(<AppstoreOutlined />, "Collection Details")} size="small">
      <Form.Item label="Title" name="title" rules={[{ required: true }]}>
        <Input onChange={onTitleChange} />
      </Form.Item>
      <Form.Item label="Slug" name="slug" rules={[{ required: true }]}>
        <Input />
      </Form.Item>
      <Form.Item label="Subtitle" name="subtitle">
        <Input />
      </Form.Item>
      <Form.Item label="Tamil title" name="titleTa">
        <Input />
      </Form.Item>
      <Form.Item label="Tamil subtitle" name="subtitleTa">
        <Input />
      </Form.Item>
      <Form.Item label="Kind" name="kind">
        <Select options={EDITABLE_COLLECTION_KINDS.map((value) => ({ value, label: CollectionKindLabels[value] }))} />
      </Form.Item>
      <Form.Item label="Schedule" name="schedule">
        <DatePicker.RangePicker showTime allowEmpty={[true, true]} style={{ width: "100%" }} />
      </Form.Item>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item label="Sort Order" name="sortOrder">
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item label="Active" name="isActive" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Col>
      </Row>
    </Card>
  );
}

function ProductsCard({ form, drafted }: { form: FormInstance; drafted: DraftProduct[] }) {
  const { selectProps } = useSelect({
    resource: "products",
    optionLabel: "name",
    optionValue: "id",
    onSearch: (value) => [{ field: "q", operator: "contains", value }],
  });
  // Drafted products are in the select even when its first page doesn't hold them, so their chips show names
  const known = new Set((selectProps.options ?? []).map((o) => o.value));
  const options = [...drafted.filter((p) => !known.has(p.id)).map((p) => ({ value: p.id, label: p.name })), ...(selectProps.options ?? [])];
  return (
    <Card title={sectionTitle(<AppstoreOutlined />, "Products & Image")} size="small">
      <Form.Item label="Products" name="productIds">
        <Select {...selectProps} options={options} mode="multiple" filterOption={false} placeholder="Type a product name to search" allowClear />
      </Form.Item>
      <BannerOption form={form} />
      <Form.Item label="Cover Image" name="imageUrl" getValueFromEvent={(url: string) => url}>
        <ImageUpload />
      </Form.Item>
    </Card>
  );
}

export const CollectionCreate = () => {
  const drawBanner = useRef(false);
  const afterCreate = useBannerAfterCreate();
  const { formProps, saveButtonProps } = useForm({
    resource: "collections",
    redirect: false,
    onMutationSuccess: (res) => afterCreate(String(res.data.id), drawBanner.current),
  });
  const [drafted, setDrafted] = useState<DraftProduct[]>([]);
  const form = formProps.form!;

  const onTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    form.setFieldsValue({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") });
  };
  const onFinish = (values: CreateValues) => {
    drawBanner.current = !!values.artDirection && values.generateBanner !== false;
    return formProps.onFinish?.(toPayload(values));
  };

  return (
    <Create saveButtonProps={saveButtonProps}>
      <ReadableSection>
        <AiBuilderCard form={form} onDrafted={setDrafted} />
        <Form {...formProps} layout="vertical" initialValues={{ isActive: true, sortOrder: 0, kind: "STANDARD" }} onFinish={onFinish}>
          <Form.Item name="artDirection" hidden><Input /></Form.Item>
          <Form.Item name="organizationId" hidden><Input /></Form.Item>
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}><DetailsCard onTitleChange={onTitleChange} /></Col>
            <Col xs={24} lg={12}><ProductsCard form={form} drafted={drafted} /></Col>
          </Row>
        </Form>
      </ReadableSection>
    </Create>
  );
};
