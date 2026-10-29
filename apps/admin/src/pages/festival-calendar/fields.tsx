import { Form, Input, InputNumber, Select, Switch, Card, DatePicker } from "antd";
import { CalendarOutlined } from "@ant-design/icons";
import { CollectionKindLabels, FESTIVAL_REGIONS } from "@martly/shared/constants";
import { sectionTitle } from "../../theme";

const kindOptions = (["OCCASION", "SEASON"] as const).map((value) => ({
  value,
  label: CollectionKindLabels[value],
}));

const regionOptions = Object.entries(FESTIVAL_REGIONS).map(([value, label]) => ({ value, label }));

export const FestivalFields = ({ onNameChange }: { onNameChange?: (e: React.ChangeEvent<HTMLInputElement>) => void }) => (
  <Card title={sectionTitle(<CalendarOutlined />, "Festival Details")} size="small">
    <Form.Item label="Name" name="name" rules={[{ required: true }]}>
      <Input onChange={onNameChange} />
    </Form.Item>
    <Form.Item
      label="Slug"
      name="slug"
      rules={[{ required: true, pattern: /^[a-z0-9-]+$/, message: "Lowercase letters, numbers, and hyphens only" }]}
    >
      <Input />
    </Form.Item>
    <Form.Item label="Kind" name="kind" rules={[{ required: true }]}>
      <Select options={kindOptions} />
    </Form.Item>
    <Form.Item label="Festival dates" name="dates" rules={[{ required: true }]}>
      <DatePicker.RangePicker style={{ width: "100%" }} />
    </Form.Item>
    <Form.Item
      label="Lead days"
      name="leadDays"
      extra="Days before the festival that the collection goes live"
      rules={[{ required: true }]}
    >
      <InputNumber min={0} max={60} precision={0} style={{ width: "100%" }} />
    </Form.Item>
    <Form.Item label="Regions" name="regions" rules={[{ required: true, type: "array", min: 1 }]}>
      <Select mode="multiple" options={regionOptions} />
    </Form.Item>
    <Form.Item
      label="Guidance"
      name="guidance"
      extra="Hints for picking products, e.g. vegetarian, traditional dishes"
    >
      <Input.TextArea rows={3} />
    </Form.Item>
    <Form.Item label="Active" name="isActive" valuePropName="checked">
      <Switch />
    </Form.Item>
  </Card>
);
