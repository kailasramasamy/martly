import { ColorPicker, Form, Input, InputNumber, Radio, Space, Switch, Typography, theme as antTheme } from "antd";
import { HOME_ROW_MAX_PRODUCTS, SectionHeaderStyle } from "@martly/shared/constants";
import { ImageUpload } from "../../components/ImageUpload";

const { Text } = Typography;

const colorField = { getValueFromEvent: (c: { toHexString: () => string }) => c.toHexString() };
const urlField = { getValueFromEvent: (url: string) => url };

const HEADER_STYLES = [
  { value: SectionHeaderStyle.PLAIN, label: "Plain", hint: "Title and See all on the page background" },
  { value: SectionHeaderStyle.BANNER, label: "Banner", hint: "Tinted strip behind the title with a header image" },
  { value: SectionHeaderStyle.ARTWORK, label: "Artwork", hint: "Full-width artwork above the products" },
];

export const ProductRowFields = () => (
  <>
    <Form.Item label="Header style" name={["config", "headerStyle"]} initialValue="PLAIN">
      <Radio.Group>
        <Space direction="vertical">
          {HEADER_STYLES.map((s) => (
            <Radio key={s.value} value={s.value}>
              {s.label} <Text type="secondary">{s.hint}</Text>
            </Radio>
          ))}
        </Space>
      </Radio.Group>
    </Form.Item>
    <Form.Item label="Header image" name={["config", "headerImageUrl"]} {...urlField}>
      <ImageUpload />
    </Form.Item>
    <Form.Item label="Tint colour" name={["config", "tint"]} {...colorField}>
      <ColorPicker showText disabledAlpha />
    </Form.Item>
    <Form.Item label="Max products" name={["config", "maxProducts"]} initialValue={HOME_ROW_MAX_PRODUCTS}>
      <InputNumber min={3} max={20} />
    </Form.Item>
  </>
);

const ThemePreview = ({ background, title, dark, label }: { background?: string; title?: string; dark?: boolean; label?: string }) => {
  const { token } = antTheme.useToken();
  return (
    <div
      style={{
        background: background ?? token.colorFillSecondary,
        color: title ?? token.colorText,
        borderRadius: token.borderRadius,
        padding: "12px 16px",
        marginBottom: 16,
        fontWeight: 600,
        border: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      {label || "Campaign title"}
      <div style={{ fontSize: 12, fontWeight: 400, opacity: 0.8 }}>{dark ? "Light status bar text" : "Dark status bar text"}</div>
    </div>
  );
};

/** Theme colours are only sent when the switch is on; the preview follows the live form values */
export const CampaignCardFields = ({ themed, onThemedChange }: { themed: boolean; onThemedChange: (v: boolean) => void }) => {
  const form = Form.useFormInstance();
  const theme = Form.useWatch(["config", "theme"], form) as { background?: string; title?: string; dark?: boolean } | undefined;
  const label = Form.useWatch(["config", "offerLabel"], form) as string | undefined;
  return (
    <>
      <Form.Item label="Offer label" name={["config", "offerLabel"]} extra="Short badge such as 'UP TO 30% OFF'">
        <Input maxLength={24} />
      </Form.Item>
      <Form.Item label="Image" name={["config", "imageUrl"]} {...urlField}>
        <ImageUpload />
      </Form.Item>
      <Form.Item label="Tile source" name={["config", "tileSource"]} initialValue="AUTO" extra="Auto builds tiles from the collection's categories; Items uses the tiles you define">
        <Radio.Group options={[{ value: "AUTO", label: "Auto" }, { value: "ITEMS", label: "Items" }]} optionType="button" />
      </Form.Item>
      <Form.Item label="Custom theme">
        <Switch checked={themed} onChange={onThemedChange} />
      </Form.Item>
      {themed && (
        <>
          <ThemePreview {...theme} label={label} />
          <Space size="large" align="start">
            <Form.Item label="Background" name={["config", "theme", "background"]} initialValue="#0f766e" {...colorField}>
              <ColorPicker showText disabledAlpha />
            </Form.Item>
            <Form.Item label="Title" name={["config", "theme", "title"]} initialValue="#ffffff" {...colorField}>
              <ColorPicker showText disabledAlpha />
            </Form.Item>
            <Form.Item label="Dark" name={["config", "theme", "dark"]} valuePropName="checked" initialValue={false}>
              <Switch />
            </Form.Item>
          </Space>
        </>
      )}
    </>
  );
};

