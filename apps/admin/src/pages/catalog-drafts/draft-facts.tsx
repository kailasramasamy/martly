import { Card, Descriptions, Table, Tag, Typography } from "antd";
import type { CatalogDraftDetail, CatalogDraftLabel } from "@martly/shared/types";
import { FOOD_TYPE_CONFIG } from "../../constants/tag-colors";

const { Text } = Typography;
const dash = (v: string | number | null | undefined) => (v === null || v === undefined || v === "" ? "—" : v);
const rupees = (v: number | null) => (v === null ? "—" : `₹${v.toLocaleString("en-IN")}`);

function LabelFacts({ label }: { label: CatalogDraftLabel }) {
  const food = label.foodType ? FOOD_TYPE_CONFIG[label.foodType] : null;
  return (
    <Card title="Read from the label" size="small">
      <Descriptions column={{ xs: 1, md: 2 }} size="small" bordered>
        <Descriptions.Item label="Name">{label.name}</Descriptions.Item>
        <Descriptions.Item label="Brand on pack">{dash(label.brand)}</Descriptions.Item>
        <Descriptions.Item label="Size">{label.variantName}</Descriptions.Item>
        <Descriptions.Item label="Barcode">{dash(label.barcode)}</Descriptions.Item>
        <Descriptions.Item label="Printed MRP">{rupees(label.printedMrp)}</Descriptions.Item>
        <Descriptions.Item label="Food type">{food ? <Tag color={food.color}>{food.label}</Tag> : "—"}</Descriptions.Item>
        <Descriptions.Item label="FSSAI">{dash(label.fssaiLicense)}</Descriptions.Item>
        <Descriptions.Item label="Manufacturer">{dash(label.manufacturerName)}</Descriptions.Item>
        <Descriptions.Item label="Origin">{dash(label.countryOfOrigin)}</Descriptions.Item>
        <Descriptions.Item label="Shelf life">{label.shelfLifeDays ? `${label.shelfLifeDays} days` : "—"}</Descriptions.Item>
        <Descriptions.Item label="Storage" span={2}>{dash(label.storageInstructions ?? label.storageType)}</Descriptions.Item>
        <Descriptions.Item label="Ingredients" span={2}>{dash(label.ingredients)}</Descriptions.Item>
        <Descriptions.Item label="Description" span={2}>{dash(label.description)}</Descriptions.Item>
        <Descriptions.Item label="Tags" span={2}>{label.tags.map((t) => <Tag key={t}>{t}</Tag>)}</Descriptions.Item>
        <Descriptions.Item label="Notes" span={2}>{dash(label.notes)}</Descriptions.Item>
      </Descriptions>
      {label.nutrition.length > 0 && (
        <Table
          style={{ marginTop: 16 }}
          size="small"
          pagination={false}
          rowKey="name"
          dataSource={label.nutrition}
          columns={[{ title: "Nutrition", dataIndex: "name" }, { title: "Per serving", dataIndex: "value" }]}
        />
      )}
    </Card>
  );
}

function Picks({ draft }: { draft: CatalogDraftDetail }) {
  return (
    <Card title="Our picks" size="small">
      <Descriptions column={1} size="small">
        <Descriptions.Item label="Brand">
          {draft.brand ? `${draft.brand.name} (${dash(draft.brandConfidence)})` : <Text type="secondary">No match</Text>}
        </Descriptions.Item>
        <Descriptions.Item label="Aisle">
          {draft.subcategory ? `${draft.subcategory.path} (${dash(draft.subcategoryConfidence)})` : <Text type="secondary">No match</Text>}
        </Descriptions.Item>
      </Descriptions>
    </Card>
  );
}

function Usage({ usage }: { usage: CatalogDraftDetail["usage"] }) {
  const total = usage.reduce((sum, u) => sum + u.usd, 0);
  return (
    <Card title="Processing usage" size="small">
      <Table
        size="small"
        pagination={false}
        rowKey={(u) => `${u.step}-${u.model}`}
        dataSource={usage}
        columns={[
          { title: "Step", dataIndex: "step" },
          { title: "Model", dataIndex: "model" },
          { title: "Tokens in / out", render: (_, u) => `${u.inputTokens} / ${u.outputTokens}` },
          { title: "USD", dataIndex: "usd", render: (v: number) => `$${v.toFixed(3)}` },
        ]}
        summary={() => (
          <Table.Summary.Row>
            <Table.Summary.Cell index={0} colSpan={3}><Text strong>Total</Text></Table.Summary.Cell>
            <Table.Summary.Cell index={1}><Text strong>{`$${total.toFixed(3)}`}</Text></Table.Summary.Cell>
          </Table.Summary.Row>
        )}
      />
    </Card>
  );
}

export function DraftFacts({ draft }: { draft: CatalogDraftDetail }) {
  return (
    <>
      {draft.label && <LabelFacts label={draft.label} />}
      <Picks draft={draft} />
      {draft.usage.length > 0 && <Usage usage={draft.usage} />}
    </>
  );
}
