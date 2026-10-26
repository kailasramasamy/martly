import { useState } from "react";
import { Create } from "@refinedev/antd";
import { useInvalidate } from "@refinedev/core";
import { Form, Card, Radio, Space, Typography, message } from "antd";
import { ShoppingOutlined } from "@ant-design/icons";
import { Link, useNavigate, useSearchParams } from "react-router";

import { axiosInstance } from "../../providers/data-provider";
import { sectionTitle } from "../../theme";
import { ReadableSection } from "../../components/ReadableSection";
import { StoreSelect } from "../../components/StoreSelect";
import { OfferCard } from "../../components/OfferFields";
import { OFFER_KIND_CONFIG } from "./describe";
import { ListingPicker, type PickedListing } from "./ListingPicker";
import { DiscountCard, MemberPriceCard, offerBody, type OfferFormValues } from "./terms";

const KIND_HINTS = { BUY_GET: "1 + 1, 2 + 1 or your own", DISCOUNT: "₹ or % off the price", MEMBER_PRICE: "A lower price for Mart Plus members" };

/** One offer on many of a store's products: the kind and its terms, the products, then start it */
export const OfferCreate = () => {
  const [form] = Form.useForm<OfferFormValues>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const invalidate = useInvalidate();
  const [picked, setPicked] = useState<PickedListing[]>([]);
  const [saving, setSaving] = useState(false);
  const kind = Form.useWatch("kind", form) ?? "BUY_GET";
  const storeId = Form.useWatch("storeId", form);

  const save = async (values: OfferFormValues) => {
    const body = offerBody(values, picked);
    if (typeof body === "string") return void message.error(body);
    setSaving(true);
    try {
      await axiosInstance.post("/offers", body);
      message.success(`Offer started on ${picked.length} product${picked.length === 1 ? "" : "s"}`);
      invalidate({ resource: "offers", invalidates: ["list"] });
      navigate("/offers");
    } catch (err: any) {
      message.error(err.response?.data?.message ?? "Couldn't start the offer");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Create title="New offer" saveButtonProps={{ onClick: form.submit, loading: saving, children: "Start offer" }}>
      <ReadableSection>
        <Form form={form} layout="vertical" onFinish={save} initialValues={{ kind: "BUY_GET", storeId: params.get("storeId") ?? undefined }}>
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Card size="small">
              <Form.Item label="Store" name="storeId" rules={[{ required: true, message: "Pick a store" }]}>
                <StoreSelect onChange={() => setPicked([])} style={{ maxWidth: 400 }} />
              </Form.Item>
              <Form.Item label="On products" name="kind" extra={KIND_HINTS[kind]}>
                <Radio.Group optionType="button" buttonStyle="solid" options={Object.entries(OFFER_KIND_CONFIG).map(([value, k]) => ({ value, label: k.label }))} />
              </Form.Item>
              <Typography.Text type="secondary">
                On the whole order: <Link to="/coupons/create">New coupon</Link> · <Link to="/promos/create">New promotion</Link>
              </Typography.Text>
            </Card>
            {kind === "BUY_GET" && <OfferCard />}
            {kind === "DISCOUNT" && <DiscountCard />}
            {kind === "MEMBER_PRICE" && <MemberPriceCard />}
            <Card title={sectionTitle(<ShoppingOutlined />, `Products (${picked.length})`)} size="small">
              <ListingPicker storeId={storeId} picked={picked} onChange={setPicked} />
            </Card>
          </Space>
        </Form>
      </ReadableSection>
    </Create>
  );
};
