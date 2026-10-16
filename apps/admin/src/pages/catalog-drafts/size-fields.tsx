import { Button, Card, Col, Form, Input, InputNumber, Row, Select } from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { UNIT_TYPES } from "../products/product-form-options";

const required = { required: true, message: "Required" };

/** Extra pack sizes of one product under `name`, each with its own price and stock in the draft's store */
export function SizeFields({ name, unitType }: { name: string; unitType?: string }) {
  return (
    <Form.List name={name}>
      {(fields, { add, remove }) => (
        <>
          {fields.map(({ key, name: index }) => (
            <Card key={key} size="small" style={{ marginBottom: 12 }} title={`Another size ${index + 1}`}
              extra={<Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(index)} aria-label="Remove size" />}>
              <Row gutter={12}>
                <Col xs={24} md={8}><Form.Item label="Size name" name={[index, "name"]} rules={[required]}><Input placeholder="e.g. 5 kg" /></Form.Item></Col>
                <Col xs={12} md={8}><Form.Item label="Unit type" name={[index, "unitType"]} rules={[required]}><Select options={UNIT_TYPES.map((u) => ({ value: u, label: u }))} /></Form.Item></Col>
                <Col xs={12} md={8}><Form.Item label="Unit value" name={[index, "unitValue"]} rules={[required]}><InputNumber min={0} style={{ width: "100%" }} /></Form.Item></Col>
                <Col xs={8}><Form.Item label={"MRP (₹)"} name={[index, "mrp"]} rules={[required]}><InputNumber min={0} style={{ width: "100%" }} /></Form.Item></Col>
                <Col xs={8}>
                  <Form.Item
                    label={"Selling price (₹)"}
                    name={[index, "sellingPrice"]}
                    dependencies={[[name, index, "mrp"]]}
                    rules={[
                      required,
                      ({ getFieldValue }) => ({
                        validator: (_, value: number) => (value <= getFieldValue([name, index, "mrp"]) ? Promise.resolve() : Promise.reject(new Error("Cannot exceed MRP"))),
                      }),
                    ]}
                  >
                    <InputNumber min={0} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col xs={8}><Form.Item label="Stock" name={[index, "stock"]}><InputNumber min={0} precision={0} style={{ width: "100%" }} /></Form.Item></Col>
              </Row>
            </Card>
          ))}
          <Button icon={<PlusOutlined />} onClick={() => add({ unitType, stock: 0 })}>Add another size</Button>
        </>
      )}
    </Form.List>
  );
}
