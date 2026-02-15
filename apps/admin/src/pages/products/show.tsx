import { Show } from "@refinedev/antd";
import { useShow } from "@refinedev/core";
import { Typography, Image, Table, Tag } from "antd";

const { Title, Text } = Typography;

const FOOD_TYPE_CONFIG: Record<string, { color: string; label: string }> = {
  VEG: { color: "green", label: "Vegetarian" },
  NON_VEG: { color: "red", label: "Non-Vegetarian" },
  VEGAN: { color: "lime", label: "Vegan" },
  EGG: { color: "orange", label: "Egg" },
};

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  GROCERY: "Grocery",
  SNACKS: "Snacks",
  BEVERAGES: "Beverages",
  DAIRY: "Dairy",
  FROZEN: "Frozen",
  FRESH_PRODUCE: "Fresh Produce",
  BAKERY: "Bakery",
  PERSONAL_CARE: "Personal Care",
  HOUSEHOLD: "Household",
  BABY_CARE: "Baby Care",
  PET_CARE: "Pet Care",
  OTC_PHARMA: "OTC Pharma",
};

export const ProductShow = () => {
  const { query } = useShow({ resource: "products" });
  const record = query?.data?.data;

  if (!record) return null;

  const foodTypeConfig = record.foodType ? FOOD_TYPE_CONFIG[record.foodType as string] : null;

  return (
    <Show>
      <Title level={5}>Name</Title>
      <Text>{record.name}</Text>

      <Title level={5}>Brand</Title>
      <Text>{record.brand ?? "—"}</Text>

      <Title level={5}>Description</Title>
      <Text>{record.description ?? "—"}</Text>

      <Title level={5}>Category</Title>
      <Text>{record.category?.name ?? "—"}</Text>

      <Title level={5}>HSN Code</Title>
      <Text>{record.hsnCode ?? "—"}</Text>

      <Title level={5}>GST %</Title>
      <Text>{record.gstPercent != null ? `${record.gstPercent}%` : "—"}</Text>

      <Title level={5}>Food Type</Title>
      {foodTypeConfig ? <Tag color={foodTypeConfig.color}>{foodTypeConfig.label}</Tag> : <Text>—</Text>}

      <Title level={5}>FSSAI License</Title>
      <Text>{record.fssaiLicense ?? "—"}</Text>

      <Title level={5}>Product Type</Title>
      <Text>{record.productType ? (PRODUCT_TYPE_LABELS[record.productType as string] ?? record.productType) : "—"}</Text>

      <Title level={5}>Tags</Title>
      <div>{record.tags?.length > 0 ? record.tags.map((t: string) => <Tag key={t}>{t}</Tag>) : <Text>—</Text>}</div>

      <Title level={5}>Regulatory Marks</Title>
      <div>{record.regulatoryMarks?.length > 0 ? record.regulatoryMarks.map((m: string) => <Tag key={m} color="blue">{m}</Tag>) : <Text>—</Text>}</div>

      <Title level={5}>Certifications</Title>
      <div>{record.certifications?.length > 0 ? record.certifications.map((c: string) => <Tag key={c} color="green">{c}</Tag>) : <Text>—</Text>}</div>

      <Title level={5}>Mfg License No</Title>
      <Text>{record.mfgLicenseNo ?? "—"}</Text>

      <Title level={5}>Danger Warnings</Title>
      <Text>{record.dangerWarnings ?? "—"}</Text>

      <Title level={5}>Usage Instructions</Title>
      <Text>{record.usageInstructions ?? "—"}</Text>

      <Title level={5}>Ingredients</Title>
      <Text>{record.ingredients ?? "—"}</Text>

      <Title level={5}>Nutritional Info</Title>
      <Text>{record.nutritionalInfo ? JSON.stringify(record.nutritionalInfo, null, 2) : "—"}</Text>

      <Title level={5}>Allergens</Title>
      <div>{record.allergens?.length > 0 ? record.allergens.map((a: string) => <Tag key={a} color="warning">{a}</Tag>) : <Text>—</Text>}</div>

      <Title level={5}>Serving Size</Title>
      <Text>{record.servingSize ?? "—"}</Text>

      <Title level={5}>Shelf Life</Title>
      <Text>{record.shelfLifeDays != null ? `${record.shelfLifeDays} days` : "—"}</Text>

      <Title level={5}>Storage Instructions</Title>
      <Text>{record.storageInstructions ?? "—"}</Text>

      <Title level={5}>Manufacturer</Title>
      <Text>{record.manufacturerName ?? "—"}</Text>

      <Title level={5}>Country of Origin</Title>
      <Text>{record.countryOfOrigin ?? "—"}</Text>

      <Title level={5}>Image</Title>
      {record.imageUrl ? <Image width={200} src={record.imageUrl} /> : <Text>—</Text>}

      <Title level={5}>Additional Images</Title>
      <div>{record.images?.length > 0 ? record.images.map((url: string, i: number) => <Image key={i} width={100} src={url} style={{ marginRight: 8 }} />) : <Text>—</Text>}</div>

      <Title level={5} style={{ marginTop: 16 }}>Variants</Title>
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
      </Table>
    </Show>
  );
};
