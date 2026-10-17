import { Button, Card, Form, Typography, type FormInstance } from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { BannerSlotsNote } from "../../banners/banner-shared";
import type { CascaderOption } from "../../banners/category-target";
import { PromoBannerFields } from "./banner-fields";

const MAX_BANNERS = 6;
const NEW_BANNER = { textInImage: true };

interface Props {
  form: FormInstance;
  tree: CascaderOption[];
  aiImages?: { used: number; total: number };
  slots?: { used: number; total: number | null };
}

/** The banners the promotion runs; each takes a banner slot while live */
export function ManualBanners({ form, tree, aiImages, slots }: Props) {
  return (
    <Form.List name="banners">
      {(fields, { add, remove }) => (
        <>
          <Typography.Paragraph type="secondary">Each banner uses a banner slot while the promotion is live. <BannerSlotsNote slots={slots} /></Typography.Paragraph>
          {fields.map((field, index) => (
            <Card
              key={field.key}
              size="small"
              title={`Banner ${index + 1}`}
              style={{ marginBottom: 16 }}
              extra={fields.length > 1 && <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(field.name)} aria-label={`Remove banner ${index + 1}`} />}
            >
              <PromoBannerFields form={form} tree={tree} aiImages={aiImages} prefix={{ list: "banners", index: field.name }} />
            </Card>
          ))}
          <Button icon={<PlusOutlined />} disabled={fields.length >= MAX_BANNERS} onClick={() => add(NEW_BANNER)}>Add another placement</Button>
        </>
      )}
    </Form.List>
  );
}
