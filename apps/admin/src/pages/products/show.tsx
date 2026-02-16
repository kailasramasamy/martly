import { Show } from "@refinedev/antd";
import { useShow, useGetIdentity } from "@refinedev/core";
import { Typography, Image, Table, Tag, Card, Descriptions, Row, Col, Space, Button, Alert } from "antd";
import { useNavigate } from "react-router";
import {
  InfoCircleOutlined,
  SafetyCertificateOutlined,
  PictureOutlined,
  TagsOutlined,
  ExperimentOutlined,
  AppstoreOutlined,
  ShopOutlined,
} from "@ant-design/icons";

import { FOOD_TYPE_CONFIG, PRODUCT_TYPE_CONFIG, STORAGE_TYPE_CONFIG } from "../../constants/tag-colors";
import { sectionTitle } from "../../theme";

const { Text } = Typography;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const parseNutritionalData = (data: any): any => {
  if (typeof data === "string") {
    try { return JSON.parse(data); } catch { return null; }
  }
  return data;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const NutritionalInfoView = ({ data }: { data: any }) => {
  const parsed = parseNutritionalData(data);
  if (!parsed || typeof parsed !== "object") return <Text>{String(data)}</Text>;

  // If it has an ingredients array, render as recipe card
  if (Array.isArray(parsed.ingredients)) {
    return (
      <div>
        {parsed.recipe && <Text strong>{parsed.recipe}</Text>}
        {parsed.yield && <Text type="secondary" style={{ marginLeft: 8 }}>({parsed.yield})</Text>}
        <Table
          dataSource={parsed.ingredients}
          rowKey={(_: unknown, i?: number) => String(i)}
          pagination={false}
          size="small"
          style={{ marginTop: 8 }}
        >
          <Table.Column dataIndex="name" title="Ingredient" />
          <Table.Column
            title="Amount"
            render={(_: unknown, r: { amount?: number; unit?: string }) =>
              r.amount != null ? `${r.amount} ${r.unit ?? ""}`.trim() : "—"
            }
          />
        </Table>
      </div>
    );
  }

  // Otherwise render key-value pairs (e.g. {energy: "250kcal", protein: "8g"})
  const entries = Object.entries(parsed);
  if (entries.length === 0) return <Text>—</Text>;

  return (
    <Table
      dataSource={entries.map(([key, val]) => ({ key, label: key.replace(/_/g, " ").replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()), value: String(val) }))}
      rowKey="key"
      pagination={false}
      size="small"
      showHeader={false}
    >
      <Table.Column dataIndex="label" render={(v: string) => <Text strong>{v}</Text>} width="40%" />
      <Table.Column dataIndex="value" />
    </Table>
  );
};

export const ProductShow = () => {
  const { query } = useShow({ resource: "products" });
  const record = query?.data?.data;
  const { data: identity } = useGetIdentity<{ role: string }>();
  const navigate = useNavigate();

  if (!record) return null;

  const isMasterProduct = record.organizationId == null;
  const isOrgAdmin = identity?.role === "ORG_ADMIN";
  const isSuperAdmin = identity?.role === "SUPER_ADMIN";

  // SUPER_ADMIN can edit master only; ORG_ADMIN can edit their org products only
  const canEdit = isSuperAdmin ? isMasterProduct : isOrgAdmin ? !isMasterProduct : false;

  const foodTypeConfig = record.foodType ? FOOD_TYPE_CONFIG[record.foodType as string] : null;
  const productTypeConfig = record.productType ? PRODUCT_TYPE_CONFIG[record.productType as string] : null;
  const storageTypeConfig = record.storageType ? STORAGE_TYPE_CONFIG[record.storageType as string] : null;

  return (
    <Show canEdit={canEdit} canDelete={canEdit}>
      <Row gutter={[16, 16]}>
        {/* Left column: details */}
        <Col xs={24} lg={record.imageUrl || record.images?.length > 0 ? 16 : 24}>
          <Card title={sectionTitle(<InfoCircleOutlined />, "Basic Information")} size="small" style={{ marginBottom: 16 }}>
            <Descriptions column={{ xs: 1, sm: 2 }} size="small" bordered>
              <Descriptions.Item label="Name">{record.name}</Descriptions.Item>
              <Descriptions.Item label="Brand">{record.brand?.name ?? "—"}</Descriptions.Item>
              <Descriptions.Item label="Category">{record.category?.name ?? "—"}</Descriptions.Item>
              <Descriptions.Item label="Product Type">
                {productTypeConfig ? <Tag color={productTypeConfig.color}>{productTypeConfig.label}</Tag> : <Text>{record.productType ?? "—"}</Text>}
              </Descriptions.Item>
              <Descriptions.Item label="Food Type">
                {foodTypeConfig ? <Tag color={foodTypeConfig.color}>{foodTypeConfig.label}</Tag> : <Text>—</Text>}
              </Descriptions.Item>
              <Descriptions.Item label="Shelf Life">
                {record.shelfLifeDays != null ? `${record.shelfLifeDays} days` : "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Description" span={2}>
                {record.description ?? "—"}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card title={sectionTitle(<SafetyCertificateOutlined />, "Compliance & Regulatory")} size="small" style={{ marginBottom: 16 }}>
            <Descriptions column={{ xs: 1, sm: 2 }} size="small" bordered>
              <Descriptions.Item label="HSN Code">{record.hsnCode ?? "—"}</Descriptions.Item>
              <Descriptions.Item label="GST %">{record.gstPercent != null ? `${record.gstPercent}%` : "—"}</Descriptions.Item>
              <Descriptions.Item label="FSSAI License">{record.fssaiLicense ?? "—"}</Descriptions.Item>
              <Descriptions.Item label="Mfg License No">{record.mfgLicenseNo ?? "—"}</Descriptions.Item>
              <Descriptions.Item label="Manufacturer">{record.manufacturerName ?? "—"}</Descriptions.Item>
              <Descriptions.Item label="Country of Origin">{record.countryOfOrigin ?? "—"}</Descriptions.Item>
              <Descriptions.Item label="Regulatory Marks" span={2}>
                {record.regulatoryMarks?.length > 0
                  ? record.regulatoryMarks.map((m: string) => <Tag key={m} color="blue">{m}</Tag>)
                  : "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Certifications" span={2}>
                {record.certifications?.length > 0
                  ? record.certifications.map((c: string) => <Tag key={c} color="green">{c}</Tag>)
                  : "—"}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        {/* Right column: images */}
        {(record.imageUrl || record.images?.length > 0) && (
          <Col xs={24} lg={8}>
            <Card title={sectionTitle(<PictureOutlined />, "Images")} size="small" style={{ marginBottom: 16 }}>
              {record.imageUrl && (
                <div style={{ marginBottom: 12 }}>
                  <Image width="100%" style={{ maxWidth: 280, borderRadius: 6 }} src={record.imageUrl} />
                </div>
              )}
              {record.images?.length > 0 && (
                <Space wrap>
                  {record.images.map((url: string, i: number) => (
                    <Image key={i} width={80} style={{ borderRadius: 4 }} src={url} />
                  ))}
                </Space>
              )}
            </Card>

            <Card title={sectionTitle(<TagsOutlined />, "Tags & Labels")} size="small">
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label="Tags">
                  {record.tags?.length > 0
                    ? record.tags.map((t: string) => <Tag key={t}>{t}</Tag>)
                    : "—"}
                </Descriptions.Item>
                <Descriptions.Item label="Allergens">
                  {record.allergens?.length > 0
                    ? record.allergens.map((a: string) => <Tag key={a} color="warning">{a}</Tag>)
                    : "—"}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
        )}

        {/* If no images, show tags inline instead */}
        {!record.imageUrl && !(record.images?.length > 0) && (
          <Col xs={24}>
            <Card title={sectionTitle(<TagsOutlined />, "Tags & Labels")} size="small" style={{ marginBottom: 16 }}>
              <Descriptions column={{ xs: 1, sm: 2 }} size="small" bordered>
                <Descriptions.Item label="Tags">
                  {record.tags?.length > 0
                    ? record.tags.map((t: string) => <Tag key={t}>{t}</Tag>)
                    : "—"}
                </Descriptions.Item>
                <Descriptions.Item label="Allergens">
                  {record.allergens?.length > 0
                    ? record.allergens.map((a: string) => <Tag key={a} color="warning">{a}</Tag>)
                    : "—"}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
        )}

        {/* Product details: ingredients, nutrition, storage */}
        <Col xs={24}>
          <Card title={sectionTitle(<ExperimentOutlined />, "Product Details")} size="small" style={{ marginBottom: 16 }}>
            <Descriptions column={{ xs: 1, sm: 2 }} size="small" bordered>
              <Descriptions.Item label="Ingredients" span={2}>{record.ingredients ?? "—"}</Descriptions.Item>
              <Descriptions.Item label="Serving Size">{record.servingSize ?? "—"}</Descriptions.Item>
              <Descriptions.Item label="Storage Type">
                {storageTypeConfig ? <Tag color={storageTypeConfig.color}>{storageTypeConfig.label}</Tag> : <Text>{record.storageType ?? "—"}</Text>}
              </Descriptions.Item>
              <Descriptions.Item label="Storage Instructions">{record.storageInstructions ?? "—"}</Descriptions.Item>
              <Descriptions.Item label="Usage Instructions" span={2}>{record.usageInstructions ?? "—"}</Descriptions.Item>
              <Descriptions.Item label="Danger Warnings" span={2}>{record.dangerWarnings ?? "—"}</Descriptions.Item>
            </Descriptions>
            {record.nutritionalInfo && (
              <div style={{ marginTop: 16 }}>
                <Text strong style={{ display: "block", marginBottom: 8 }}>Nutritional Info</Text>
                <NutritionalInfoView data={record.nutritionalInfo} />
              </div>
            )}
          </Card>
        </Col>

        {/* ORG_ADMIN: show Map to Store action */}
        {isOrgAdmin && (
          <Col xs={24}>
            <Alert
              type="info"
              showIcon
              message={isMasterProduct ? "Master Catalog Product" : "Map to Store"}
              description={isMasterProduct
                ? "This product is from the master catalog. You can map its variants to your stores by assigning them with pricing and stock."
                : "Map this product's variants to your stores with pricing and stock."}
              action={
                <Button
                  type="primary"
                  icon={<ShopOutlined />}
                  onClick={() => navigate(`/products/${record.id}/map`)}
                >
                  Map to Store
                </Button>
              }
            />
          </Col>
        )}

        {/* Variants table */}
        <Col xs={24}>
          <Card title={sectionTitle(<AppstoreOutlined />, "Variants")} size="small">
            <Table
              dataSource={record.variants ?? []}
              rowKey="id"
              pagination={false}
              size="small"
            >
              <Table.Column dataIndex="name" title="Name" />
              <Table.Column dataIndex="sku" title="SKU" render={(v: string) => v ?? "—"} />
              <Table.Column dataIndex="barcode" title="Barcode" render={(v: string) => v ?? "—"} />
              <Table.Column dataIndex="unitType" title="Unit Type" />
              <Table.Column dataIndex="unitValue" title="Unit Value" />
              <Table.Column dataIndex="mrp" title="MRP" render={(v: number) => v != null ? `₹${Number(v).toFixed(2)}` : "—"} />
              <Table.Column dataIndex="packType" title="Pack Type" render={(v: string) => v ?? "—"} />
              <Table.Column
                title="Discount"
                render={(_: unknown, r: { discountType?: string; discountValue?: number }) =>
                  r.discountType && r.discountValue != null
                    ? <Tag color="red">{r.discountType === "PERCENTAGE" ? `${r.discountValue}% OFF` : `₹${Number(r.discountValue).toFixed(2)} OFF`}</Tag>
                    : "—"
                }
              />
              <Table.Column
                title="Discount Period"
                render={(_: unknown, r: { discountStart?: string; discountEnd?: string }) => {
                  if (!r.discountStart && !r.discountEnd) return "—";
                  const fmt = (d: string) => new Date(d).toLocaleDateString();
                  const start = r.discountStart ? fmt(r.discountStart) : "—";
                  const end = r.discountEnd ? fmt(r.discountEnd) : "—";
                  return `${start} → ${end}`;
                }}
              />
            </Table>
          </Card>
        </Col>
      </Row>
    </Show>
  );
};
