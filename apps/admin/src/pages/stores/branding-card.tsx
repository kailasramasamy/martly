import { Card, Col, ColorPicker, Form, Input, Row, Select } from "antd";
import { BgColorsOutlined } from "@ant-design/icons";
import { ImageUpload } from "../../components/ImageUpload";
import { MultiImageUpload } from "../../components/MultiImageUpload";
import { sectionTitle } from "../../theme";
import { StoreCardPreview } from "./store-card-preview";

const blankToNull = (v?: string) => (v?.trim() ? v : null);

/** What shoppers see when choosing a store: photos, logo, colour, tagline, offer and highlights */
export function BrandingCard() {
  return (
    <Card title={sectionTitle(<BgColorsOutlined />, "Storefront Branding")} size="small" style={{ marginTop: 16 }}>
      <StoreCardPreview />
      <Row gutter={12}>
        <Col span={12}><Form.Item label="Cover photo" name="imageUrl" tooltip="Wide photo of the store front"><ImageUpload /></Form.Item></Col>
        <Col span={12}><Form.Item label="Logo" name="logoUrl" tooltip="Square logo; shown as a badge on the store card"><ImageUpload /></Form.Item></Col>
      </Row>
      <Form.Item label="Brand colour" name="brandColor" tooltip="Usually the main colour of the logo" getValueFromEvent={(_: unknown, hex: string) => hex || null}>
        <ColorPicker showText allowClear disabledAlpha format="hex" />
      </Form.Item>
      <Form.Item label="Store name (Tamil)" name={["translations", "ta", "name"]} tooltip="Shown to shoppers using the app in Tamil">
        <Input maxLength={80} placeholder="தமிழில் கடையின் பெயர்" />
      </Form.Item>
      <Row gutter={12}>
        <Col xs={24} md={12}>
          <Form.Item label="Tagline" name="tagline" normalize={blankToNull}><Input maxLength={80} showCount placeholder="Great products at great prices" /></Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item label="Tagline (Tamil)" name={["translations", "ta", "tagline"]}><Input maxLength={80} placeholder="தமிழில் வாசகம்" /></Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item label="Offer line" name="offerText" normalize={blankToNull} tooltip="Only promise what checkout gives. Left empty, the app shows live deals or free delivery instead.">
            <Input maxLength={80} showCount placeholder={"Flat ₹50 off on your first order"} />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item label="Offer line (Tamil)" name={["translations", "ta", "offerText"]}><Input maxLength={80} /></Form.Item>
        </Col>
      </Row>
      <Form.Item label="Highlights" name="highlights" tooltip="Up to 4 short tags, e.g. Organic, Local brands">
        <Select mode="tags" maxCount={4} tokenSeparators={[","]} placeholder="Type a tag and press Enter" open={false} />
      </Form.Item>
      <Form.Item label="Promo posters" name="promoImages" tooltip="Up to 3 posters, shown to shoppers choosing a store">
        <MultiImageUpload max={3} />
      </Form.Item>
    </Card>
  );
}
