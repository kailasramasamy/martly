import { useEffect, useState } from "react";
import { Button, Form, Input, Select, Space, Switch, Typography } from "antd";
import type { SelectProps } from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { axiosInstance } from "../../providers/data-provider";
import { ImageUpload } from "../../components/ImageUpload";

const { Text } = Typography;

export const MIN_TILES = 2;
export const MAX_TILES = 12;

const urlField = { getValueFromEvent: (url: string) => url };

interface SubcategoryOption {
  value: string;
  label: string;
}

interface DepartmentNode {
  categories: { subcategories: { id: string; name: string }[] }[];
}

const useSubcategories = () => {
  const [options, setOptions] = useState<SubcategoryOption[]>([]);
  useEffect(() => {
    axiosInstance.get("/categories/tree").then((res) => {
      const departments = res.data.data as DepartmentNode[];
      setOptions(departments.flatMap((d) => d.categories.flatMap((c) => c.subcategories.map((s) => ({ value: s.id, label: s.name })))));
    });
  }, []);
  return options;
};

interface TileGridProps {
  collectionProps: SelectProps;
  wideHint: string;
}

/** Tiles of an Explore or Shop-by-store grid; each opens a collection, optionally narrowed to aisles */
export const TileGridFields = ({ collectionProps, wideHint }: TileGridProps) => {
  const subcategories = useSubcategories();
  return (
    <Form.List name="items">
      {(fields, { add, remove }) => (
        <Form.Item label="Tiles" extra={`${MIN_TILES} to ${MAX_TILES} tiles. Leave the image empty and use Generate art on the list.`}>
          {fields.map(({ key, name }) => (
            <div key={key} style={{ marginBottom: 16 }}>
              <Space align="start" wrap>
                <Form.Item name={[name, "label"]} rules={[{ required: true, message: "Label" }]} style={{ marginBottom: 0 }}>
                  <Input placeholder="Label" maxLength={40} style={{ width: 130 }} />
                </Form.Item>
                <Form.Item name={[name, "collectionId"]} rules={[{ required: true, message: "Pick a collection" }]} style={{ marginBottom: 0 }}>
                  <Select {...collectionProps} showSearch optionFilterProp="label" placeholder="Collection" style={{ width: 190 }} />
                </Form.Item>
                <Button icon={<DeleteOutlined />} danger disabled={fields.length <= MIN_TILES} onClick={() => remove(name)} />
              </Space>
              <Form.Item name={[name, "subcategoryIds"]} style={{ marginBottom: 4, marginTop: 4 }}>
                <Select mode="multiple" allowClear optionFilterProp="label" placeholder="All aisles of the collection" options={subcategories} />
              </Form.Item>
              <Space style={{ marginBottom: 4 }}>
                <Form.Item name={[name, "wide"]} valuePropName="checked" style={{ marginBottom: 0 }}>
                  <Switch size="small" />
                </Form.Item>
                <Text type="secondary">Wide tile ({wideHint})</Text>
              </Space>
              <Form.Item name={[name, "imageUrl"]} {...urlField} style={{ marginBottom: 0 }}>
                <ImageUpload />
              </Form.Item>
            </div>
          ))}
          <Button icon={<PlusOutlined />} disabled={fields.length >= MAX_TILES} onClick={() => add({ subcategoryIds: [], wide: false })}>Add tile</Button>
        </Form.Item>
      )}
    </Form.List>
  );
};
