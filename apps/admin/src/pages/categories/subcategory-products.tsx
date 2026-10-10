import { useTable, ShowButton, EditButton } from "@refinedev/antd";
import { Table, Tag, Space, Typography } from "antd";

const { Text } = Typography;

interface ProductRow {
  id: string;
  name: string;
  imageUrl: string | null;
  isActive: boolean;
  brand: { name: string } | null;
  organization: { name: string } | null;
  variants: { id: string; name: string }[];
}

export const SubcategoryProducts = ({ subcategoryId }: { subcategoryId: string }) => {
  const { tableProps } = useTable<ProductRow>({
    resource: "products",
    syncWithLocation: false,
    filters: { permanent: [{ field: "subcategoryId", operator: "eq", value: subcategoryId }] },
    pagination: { pageSize: 30 },
  });

  return (
    <Table<ProductRow> {...tableProps} rowKey="id" size="small">
      <Table.Column<ProductRow>
        title="Product"
        render={(_, p) => (
          <Space>
            <img
              src={p.imageUrl || "https://placehold.co/32x32/f0f0f0/999?text=—"}
              alt=""
              style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover" }}
            />
            <Text strong={p.isActive} type={p.isActive ? undefined : "secondary"}>{p.name}</Text>
          </Space>
        )}
      />
      <Table.Column<ProductRow>
        title="Brand"
        width={180}
        render={(_, p) => (p.brand ? p.brand.name : <Tag>Generic</Tag>)}
      />
      <Table.Column<ProductRow>
        title="Catalog"
        width={160}
        render={(_, p) => (p.organization ? <Tag color="purple">{p.organization.name}</Tag> : <Tag color="blue">Master</Tag>)}
      />
      <Table.Column<ProductRow>
        title="Variants"
        render={(_, p) => (
          <Space size={4} wrap>
            {p.variants.map((v) => <Tag key={v.id} style={{ fontSize: 11 }}>{v.name}</Tag>)}
          </Space>
        )}
      />
      <Table.Column<ProductRow>
        title="Actions"
        width={100}
        render={(_, p) => (
          <Space>
            <ShowButton hideText size="small" resource="products" recordItemId={p.id} />
            <EditButton hideText size="small" resource="products" recordItemId={p.id} />
          </Space>
        )}
      />
    </Table>
  );
};
