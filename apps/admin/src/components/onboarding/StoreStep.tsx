import { useState } from "react";
import { Button, Card, Col, Form, Input, InputNumber, Modal, Row, Slider, App } from "antd";
import { ClockCircleOutlined, EnvironmentOutlined, PictureOutlined } from "@ant-design/icons";
import type { OnboardingStoreInput } from "@martly/shared/schemas";
import type { Town } from "@martly/shared/types";

import { sectionTitle } from "../../theme";
import { ReadableSection } from "../ReadableSection";
import { ImageUpload, logoUpload } from "../ImageUpload";
import { TownSelect } from "../TownSelect";
import { MapPreview, PlaceSearch } from "./PlaceSearch";
import type { BusinessDraft } from "./BusinessStep";
import { errorMessage, onboardingApi, type Onboarding } from "../../pages/onboarding/api";

type StoreForm = OnboardingStoreInput;

const DEFAULTS: Partial<StoreForm> = {
  deliveryRadius: 5, minOrderAmount: 99, freeDeliveryThreshold: 299, startingDeliveryFee: 20,
  expressEtaMinutes: 30, opensAt: "07:00", closesAt: "21:30",
};
const TIME_RULE = { pattern: /^([01]\d|2[0-3]):[0-5]\d$/, message: "HH:MM, 24-hour" };
const money = { style: { width: "100%" }, min: 0, addonBefore: "₹" };

function fromSaved(o: Onboarding): Partial<StoreForm> {
  const d = o.details;
  const num = (v: string | null) => (v === null ? undefined : Number(v));
  return {
    name: d.name, address: d.address, townId: d.townId ?? undefined,
    phone: d.phone ?? undefined, latitude: d.latitude ?? undefined, longitude: d.longitude ?? undefined,
    deliveryRadius: d.deliveryRadius, minOrderAmount: num(d.minOrderAmount), freeDeliveryThreshold: num(d.freeDeliveryThreshold) ?? null,
    startingDeliveryFee: d.startingDeliveryFee ?? 20, logoUrl: d.logoUrl, expressEtaMinutes: d.expressEtaMinutes ?? 30,
    opensAt: d.opensAt ?? "07:00", closesAt: d.closesAt ?? "21:30",
  };
}

function LocationCard({ initialTown }: { initialTown?: Town | null }) {
  const form = Form.useFormInstance<StoreForm>();
  const [lat, lng, radius] = [Form.useWatch("latitude", form), Form.useWatch("longitude", form), Form.useWatch("deliveryRadius", form)];
  return (
    <Card size="small" title={sectionTitle(<EnvironmentOutlined />, "Shop & location")}>
      <Form.Item label="Find the shop">
        <PlaceSearch onPick={(p) => form.setFieldsValue({ address: p.address, latitude: p.latitude, longitude: p.longitude })} />
      </Form.Item>
      <Form.Item label="Store name" name="name" rules={[{ required: true, min: 2 }]}><Input placeholder="As shoppers know it" /></Form.Item>
      <Form.Item label="Address" name="address" rules={[{ required: true, min: 5 }]}><Input.TextArea autoSize={{ minRows: 2 }} /></Form.Item>
      <Form.Item label="Town" name="townId" rules={[{ required: true }]} extra="Sets the state and district, and the region its catalog favours">
        <TownSelect initialTown={initialTown} />
      </Form.Item>
      <Row gutter={12}>
        <Col span={8}><Form.Item label="Shop phone" name="phone" rules={[{ pattern: /^\d{10}$/, message: "10 digits" }]}><Input maxLength={10} /></Form.Item></Col>
        <Col span={8}><Form.Item label="Latitude" name="latitude" rules={[{ required: true, message: "Place the pin" }]}><InputNumber style={{ width: "100%" }} step={0.0001} /></Form.Item></Col>
        <Col span={8}><Form.Item label="Longitude" name="longitude" rules={[{ required: true, message: "Place the pin" }]}><InputNumber style={{ width: "100%" }} step={0.0001} /></Form.Item></Col>
      </Row>
      <MapPreview latitude={lat} longitude={lng} radiusKm={radius ?? 5} />
    </Card>
  );
}

function DeliveryCard() {
  return (
    <>
      <Card size="small" title={sectionTitle(<ClockCircleOutlined />, "Delivery & hours")}>
        <Form.Item label="Delivery radius (km)" name="deliveryRadius"><Slider min={1} max={15} step={0.5} marks={{ 1: "1", 5: "5", 10: "10", 15: "15" }} /></Form.Item>
        <Row gutter={12}>
          <Col span={12}><Form.Item label="Delivery fee" name="startingDeliveryFee" rules={[{ required: true }]} extra="Nearest band; farther bands add ₹10 each"><InputNumber {...money} /></Form.Item></Col>
          <Col span={12}><Form.Item label="Free delivery above" name="freeDeliveryThreshold"><InputNumber {...money} placeholder="Never free" /></Form.Item></Col>
          <Col span={12}><Form.Item label="Minimum order" name="minOrderAmount" rules={[{ required: true }]}><InputNumber {...money} /></Form.Item></Col>
          <Col span={12}><Form.Item label="Express delivery (minutes)" name="expressEtaMinutes" rules={[{ required: true }]}><InputNumber style={{ width: "100%" }} min={5} max={240} /></Form.Item></Col>
          <Col span={12}><Form.Item label="Opens at" name="opensAt" rules={[{ required: true }, TIME_RULE]}><Input placeholder="07:00" /></Form.Item></Col>
          <Col span={12}><Form.Item label="Closes at" name="closesAt" rules={[{ required: true }, TIME_RULE]}><Input placeholder="21:30" /></Form.Item></Col>
        </Row>
      </Card>
      <Card size="small" title={sectionTitle(<PictureOutlined />, "Logo")} style={{ marginTop: 16 }}>
        <Form.Item name="logoUrl" extra="Any shape, on a plain or transparent background" style={{ marginBottom: 0 }}><ImageUpload upload={logoUpload} /></Form.Item>
      </Card>
    </>
  );
}

interface Props {
  onboarding?: Onboarding;
  business?: BusinessDraft;
  onBack: () => void;
  onCreated: (o: Onboarding) => void;
  onSaved: (o: Onboarding) => void;
}

/** Where the shop is, how far it delivers and when it's open; a new store is created here, still hidden */
export function StoreStep({ onboarding, business, onBack, onCreated, onSaved }: Props) {
  const { message } = App.useApp();
  const [form] = Form.useForm<StoreForm>();
  const [saving, setSaving] = useState(false);

  const create = async (store: StoreForm, upgradeShopper: boolean): Promise<void> => {
    try {
      onCreated(await onboardingApi.create({ ...business!, store, upgradeShopper }));
    } catch (err) {
      const msg = errorMessage(err, "Couldn't create the store");
      if (!upgradeShopper && msg.includes("shopper")) {
        return new Promise((resolve) => Modal.confirm({
          title: "This number already shops on Martly",
          content: `${msg}. Their orders and wallet stay with the account; it becomes the owner's login.`,
          okText: "Use it for the owner",
          onOk: () => create(store, true).then(resolve),
          onCancel: () => resolve(),
        }));
      }
      message.error(msg);
    }
  };

  const submit = async (store: StoreForm) => {
    setSaving(true);
    try {
      if (onboarding) onSaved(await onboardingApi.update(onboarding.storeId, { store }));
      else await create(store, false);
    } catch (err) {
      message.error(errorMessage(err, "Couldn't save"));
    } finally {
      setSaving(false);
    }
  };

  if (!onboarding && !business) {
    return <Button onClick={onBack}>Enter the business and owner first</Button>;
  }

  return (
    <ReadableSection>
      <Form form={form} layout="vertical" initialValues={onboarding ? fromSaved(onboarding) : DEFAULTS} onFinish={submit} requiredMark="optional">
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={13}><LocationCard initialTown={onboarding?.details.town} /></Col>
          <Col xs={24} lg={11}><DeliveryCard /></Col>
        </Row>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
          <Button onClick={onBack}>Back</Button>
          <Button type="primary" htmlType="submit" loading={saving}>{onboarding ? "Save & next" : "Create store"}</Button>
        </div>
      </Form>
    </ReadableSection>
  );
}
