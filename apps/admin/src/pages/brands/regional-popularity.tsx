import { Button, Card, Form, InputNumber, Select, Space } from "antd";
import { DeleteOutlined, EnvironmentOutlined, PlusOutlined } from "@ant-design/icons";
import { FESTIVAL_REGIONS } from "@martly/shared/constants";
import { sectionTitle } from "../../theme";

const REGION_OPTIONS = Object.entries(FESTIVAL_REGIONS)
  .filter(([code]) => code !== "ALL")
  .map(([value, label]) => ({ value, label }));

/** A brand's popularity per region, for stores in that state; regions not listed use the national score */
export const RegionalPopularityCard = () => (
  <Card
    title={sectionTitle(<EnvironmentOutlined />, "Regional popularity")}
    size="small"
    extra={<span style={{ fontSize: 12, opacity: 0.65 }}>Overrides the national score for stores in that region</span>}
  >
    <Form.List name="regionalPopularity">
      {(fields, { add, remove }) => (
        <>
          {fields.map(({ key, name }) => (
            <Space key={key} align="baseline" style={{ display: "flex" }}>
              <Form.Item name={[name, "region"]} rules={[{ required: true, message: "Pick a region" }]}>
                <Select options={REGION_OPTIONS} placeholder="Region" style={{ width: 180 }} />
              </Form.Item>
              <Form.Item name={[name, "popularity"]} rules={[{ required: true, message: "0–100" }]}>
                <InputNumber min={0} max={100} precision={0} placeholder="0–100" />
              </Form.Item>
              <Button type="text" icon={<DeleteOutlined />} aria-label="Remove region" onClick={() => remove(name)} />
            </Space>
          ))}
          <Button type="dashed" icon={<PlusOutlined />} onClick={() => add()}>
            Add region
          </Button>
        </>
      )}
    </Form.List>
  </Card>
);
