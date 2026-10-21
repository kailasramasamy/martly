import { useEffect, useState } from "react";
import { App, Card, Col, DatePicker, Form, Input, InputNumber, Row, Select, Spin, Tag } from "antd";
import { Create, Edit } from "@refinedev/antd";
import { useList } from "@refinedev/core";
import { useNavigate, useParams } from "react-router";
import type { FormInstance } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { axiosInstance } from "../../providers/data-provider";
import { formatRupees } from "../promos/promo-utils";
import { errorMessage } from "../marketing/utils";
import type { AdProduct } from "../marketing/types";
import { BookingSummary } from "./booking-summary";
import { BrandSelect } from "./brand-select";
import { CreativeSection, type CreativeMode } from "./creative-section";
import { TargetingCard, inferTargetMode, type TargetMode } from "./targeting-card";
import { ProductPicker, type SponsorableProduct } from "./product-picker";
import { EDITABLE_STATUSES, type Campaign, type CampaignScope } from "./types";
import { ReadableSection } from "../../components/ReadableSection";

interface FormValues {
  brandId?: string;
  productId: string;
  quantity: number;
  startsAt: Dayjs;
  categoryId?: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  brief?: string;
  actionTarget?: string;
  targetMode: TargetMode;
  targetStoreIds?: string[];
  targetStates?: string[];
  targetDistricts?: string[];
  discountType?: "PERCENTAGE" | "FLAT";
  discountValue?: number;
}

const DEFAULT_START_DAYS = 3;
const discountOptions = [{ value: "PERCENTAGE", label: "Percentage off" }, { value: "FLAT", label: "Flat amount off" }];

const unitLabel = (p?: AdProduct) => (p?.kind === "BRAND_CPM" ? "Thousands of views" : "Weeks");
const packageLabel = (p: AdProduct) =>
  `${p.name} · ${formatRupees(p.price)} ${p.kind === "BRAND_CPM" ? "per 1,000 views" : p.durationDays === 7 ? "per week" : `per ${p.durationDays} days`}`;

function useFormOptions(scope: CampaignScope) {
  const [packages, setPackages] = useState<AdProduct[]>([]);
  const [categories, setCategories] = useState<{ value: string; label: string }[]>([]);
  const { data: storesData } = useList<{ id: string; name: string }>({ resource: "stores", pagination: { pageSize: 200 } });

  useEffect(() => {
    axiosInstance.get(`${scope.apiBase}/packages`).then((res) => setPackages(res.data.data));
    axiosInstance.get("/categories/tree").then((res) =>
      setCategories(res.data.data.flatMap((d: { name: string; categories: { id: string; name: string }[] }) =>
        d.categories.map((c) => ({ value: c.id, label: `${d.name} › ${c.name}` })))),
    );
  }, [scope.apiBase]);
  return { packages, categories, stores: storesData?.data ?? [] };
}

function toFormValues(c: Campaign): FormValues {
  return {
    brandId: c.brandId, productId: c.productId, quantity: c.quantity, startsAt: dayjs(c.startsAt), categoryId: c.categoryId ?? undefined,
    title: c.title, subtitle: c.subtitle ?? undefined, imageUrl: c.imageUrl ?? undefined, brief: c.brief ?? undefined, actionTarget: c.actionTarget ?? undefined,
    targetMode: inferTargetMode(c), targetStoreIds: c.targetStoreIds, targetStates: c.targetStates, targetDistricts: c.targetDistricts,
    discountType: c.discountType ?? undefined, discountValue: c.discountValue ?? undefined,
  };
}

const isSponsored = (p?: AdProduct) => p?.kind === "BRAND_SPONSORED_PRODUCT";
const isPoster = (p?: AdProduct) => p?.placement === "HOME_POSTER";

function buildBody(values: FormValues, mode: CreativeMode, sponsored: boolean) {
  return {
    brandId: values.brandId,
    productId: values.productId,
    quantity: values.quantity,
    startsAt: values.startsAt.toISOString(),
    categoryId: values.categoryId ?? null,
    title: values.title,
    subtitle: values.subtitle || null,
    imageUrl: sponsored ? null : values.imageUrl ?? null,
    brief: mode === "ai" && !sponsored ? values.brief : null,
    ...(sponsored ? { actionType: "PRODUCT", actionTarget: values.actionTarget } : {}),
    targetStoreIds: values.targetMode === "STORES" ? values.targetStoreIds ?? [] : [],
    targetStates: values.targetMode === "REGIONS" ? values.targetStates ?? [] : [],
    targetDistricts: values.targetMode === "REGIONS" ? values.targetDistricts ?? [] : [],
    discountType: values.discountType ?? null,
    discountValue: values.discountValue ?? null,
  };
}

function CreativeCards({ mode, onModeChange, portrait }: { mode: CreativeMode; onModeChange: (m: CreativeMode) => void; portrait: boolean }) {
  return (
    <>
      <Card title={portrait ? "Poster text" : "Banner text"} size="small" style={{ marginBottom: 16 }}>
        <Form.Item name="title" label="Title" rules={[{ required: true, min: 2, max: 60 }]}><Input maxLength={60} /></Form.Item>
        <Form.Item name="subtitle" label="Subtitle" rules={[{ max: 90 }]}><Input maxLength={90} /></Form.Item>
      </Card>
      <Card title="Creative" size="small">
        <CreativeSection mode={mode} onModeChange={onModeChange} portrait={portrait} />
      </Card>
    </>
  );
}

/** A sponsored product is one of the brand's own products; its photo and category are the creative */
function SponsoredCard({ form, brandId, locked }: { form: FormInstance<FormValues>; brandId?: string; locked: boolean }) {
  const onPick = (p: SponsorableProduct) => form.setFieldsValue({ categoryId: p.subcategory?.category.id, title: p.name.slice(0, 60) });
  return (
    <Card title="Product to sponsor" size="small">
      <Form.Item name="title" hidden><Input /></Form.Item>
      <Form.Item name="categoryId" hidden><Input /></Form.Item>
      <Form.Item name="actionTarget" rules={[{ required: true, message: "Pick one of the brand's products" }]} extra="Placed second in Home rows and category listings, marked Ad. It can't change after payment.">
        <ProductPicker brandId={brandId} onPick={onPick} disabled={locked} />
      </Form.Item>
    </Card>
  );
}

interface FieldsProps {
  campaign: Campaign | null;
  locked: boolean;
  packages: AdProduct[];
  product?: AdProduct;
  categories: { value: string; label: string }[];
}

function BookingFields({ campaign, locked, packages, product, categories }: FieldsProps) {
  return (
    <>
      <Form.Item name="brandId" label="Brand" rules={[{ required: true }]}>
        <BrandSelect disabled={!!campaign} selected={campaign?.brand} />
      </Form.Item>
      <Form.Item name="productId" label="Package" rules={[{ required: true }]}>
        <Select disabled={locked} options={packages.map((p) => ({ value: p.id, label: packageLabel(p) }))} />
      </Form.Item>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="quantity" label={unitLabel(product)} rules={[{ required: true }]}>
            <InputNumber min={1} max={52} precision={0} disabled={locked} style={{ width: "100%" }} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="startsAt" label="Start date" rules={[{ required: true }]}>
            <DatePicker disabled={locked} style={{ width: "100%" }} disabledDate={(d) => d.isBefore(dayjs(), "day")} />
          </Form.Item>
        </Col>
      </Row>
      {product?.kind === "BRAND_TAKEOVER" && (
        <Form.Item name="categoryId" label="Category to take over" rules={[{ required: true }]}>
          <Select showSearch optionFilterProp="label" disabled={locked} options={categories} />
        </Form.Item>
      )}
      {product?.kind === "BRAND_PROMOTION" && (
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="discountType" label="Discount type" rules={[{ required: true }]}>
              <Select disabled={locked} options={discountOptions} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="discountValue" label="Discount value" rules={[{ required: true }]}>
              <InputNumber min={1} max={90} disabled={locked} style={{ width: "100%" }} />
            </Form.Item>
          </Col>
        </Row>
      )}
    </>
  );
}

/** Loads the campaign being edited; the form mounts only once it has arrived so its values seed the fields */
function useCampaignLoader(scope: CampaignScope, id: string | undefined, setMode: (m: CreativeMode) => void) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  useEffect(() => {
    if (!id) return;
    axiosInstance.get(`${scope.apiBase}/${id}`).then((res) => {
      const c: Campaign = res.data.data;
      setCampaign(c);
      setMode(c.imageUrl || !c.brief ? "upload" : "ai");
    });
  }, [id, scope.apiBase, setMode]);
  return campaign;
}

function useSave(scope: CampaignScope, id: string | undefined, mode: CreativeMode, sponsored: boolean) {
  const { notification } = App.useApp();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);

  const save = async (values: FormValues) => {
    setSaving(true);
    try {
      const body = buildBody(values, mode, sponsored);
      const res = id ? await axiosInstance.put(`${scope.apiBase}/${id}`, body) : await axiosInstance.post(scope.apiBase, body);
      navigate(`${scope.path}/show/${res.data.data.id}`);
    } catch (err) {
      notification.error({ message: errorMessage(err, "Could not save the campaign") });
    } finally {
      setSaving(false);
    }
  };
  return { save, saving };
}

export function CampaignForm({ scope }: { scope: CampaignScope }) {
  const { id } = useParams();
  const [form] = Form.useForm<FormValues>();
  const [mode, setMode] = useState<CreativeMode>("upload");
  const { packages, categories, stores } = useFormOptions(scope);
  const campaign = useCampaignLoader(scope, id, setMode);

  const productId = Form.useWatch("productId", form);
  const quantity = Form.useWatch("quantity", form);
  const startsAt = Form.useWatch("startsAt", form);
  const categoryId = Form.useWatch("categoryId", form);
  const brandId = Form.useWatch("brandId", form);
  const targetMode = Form.useWatch("targetMode", form) ?? "ALL";
  const product = packages.find((p) => p.id === productId);
  const sponsored = isSponsored(product);
  const { save, saving } = useSave(scope, id, mode, sponsored);

  if (id && !campaign) return <Spin style={{ display: "block", margin: "64px auto" }} />;
  if (campaign && !EDITABLE_STATUSES.includes(campaign.status)) return <Tag color="red">This campaign can no longer be edited</Tag>;

  const Wrapper = id ? Edit : Create;
  const locked = campaign?.status === "IN_REVIEW";
  return (
    <Wrapper title={id ? "Edit campaign" : "New campaign"} saveButtonProps={{ onClick: () => form.submit(), loading: saving }} isLoading={false}>
      <ReadableSection>
        <Form form={form} layout="vertical" onFinish={save} onValuesChange={(changed) => { if ("brandId" in changed) form.setFieldsValue({ actionTarget: undefined, categoryId: undefined }); }} initialValues={campaign ? toFormValues(campaign) : { quantity: 1, targetMode: "ALL", startsAt: dayjs().add(DEFAULT_START_DAYS, "day") }}>
          <Row gutter={24}>
            <Col xs={24} lg={12}>
              <Card title="Booking" size="small" style={{ marginBottom: 16 }}>
                <BookingFields campaign={campaign} locked={locked} packages={packages} product={product} categories={categories} />
                <BookingSummary scope={scope} product={product} quantity={quantity ?? 1} startsAt={startsAt} categoryId={categoryId} excludeId={id} />
              </Card>
              <TargetingCard mode={targetMode} locked={locked} stores={stores} />
            </Col>
            <Col xs={24} lg={12}>
              {sponsored ? (
                <SponsoredCard form={form} brandId={brandId} locked={locked} />
              ) : (
                <CreativeCards mode={mode} onModeChange={setMode} portrait={isPoster(product)} />
              )}
            </Col>
          </Row>
        </Form>
      </ReadableSection>
    </Wrapper>
  );
}
