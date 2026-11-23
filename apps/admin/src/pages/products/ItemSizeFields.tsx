import { Col, Form, InputNumber } from "antd";
import type { FormInstance } from "antd";

const FIELDS = {
  ROUND: [["topDiameterMm", "Top diameter (mm)"], ["baseDiameterMm", "Base diameter (mm)"], ["heightMm", "Height (mm)"]],
  BOX: [["lengthMm", "Length (mm)"], ["widthMm", "Width (mm)"], ["heightMm", "Height (mm)"]],
  FLAT: [["lengthMm", "Length (mm)"], ["widthMm", "Width (mm)"]],
} as const;

/** Sizes of a measured item; nothing for a packed product. Saving a change redraws its sketch. */
export function ItemSizeFields({ form, name }: { form?: FormInstance; name: number }) {
  const shape = Form.useWatch(["variants", name, "shape"], form) as keyof typeof FIELDS | null | undefined;
  if (!shape) return null;
  return (
    <>
      {FIELDS[shape].map(([field, label]) => (
        <Col xs={12} sm={6} key={field}>
          <Form.Item label={label} name={[name, field]}>
            <InputNumber min={1} max={5000} precision={0} style={{ width: "100%" }} />
          </Form.Item>
        </Col>
      ))}
    </>
  );
}
