import { Form, Input, Select } from "antd";
import { INDIAN_STATES, URL_SEGMENT_RULE } from "@martly/shared/constants";

/** Shared by the create and edit forms; `onNameChange` lets create suggest the slug */
export const TownFields = ({ onNameChange }: { onNameChange?: (e: React.ChangeEvent<HTMLInputElement>) => void }) => (
  <>
    <Form.Item label="Name" name="name" rules={[{ required: true, min: 2, max: 60 }]}>
      <Input onChange={onNameChange} />
    </Form.Item>
    <Form.Item label="Slug" name="slug" rules={[{ required: true }, URL_SEGMENT_RULE]} extra="The town part of a store's address: onmartly.in/{slug}/store">
      <Input />
    </Form.Item>
    <Form.Item label="District" name="district" rules={[{ required: true, min: 2, max: 60 }]}>
      <Input />
    </Form.Item>
    <Form.Item label="State" name="state" rules={[{ required: true }]}>
      <Select showSearch optionFilterProp="label" options={INDIAN_STATES.map((s) => ({ value: s, label: s }))} />
    </Form.Item>
  </>
);
