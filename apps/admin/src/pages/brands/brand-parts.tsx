import { useGetIdentity } from "@refinedev/core";
import { canEditCatalogRecord, type PermissionSubject } from "@martly/shared/permissions";
import { EditButton } from "@refinedev/antd";
import { Tag, Avatar, Typography, Flex } from "antd";

const { Text, Title } = Typography;

export interface BrandRecord {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  themeColor: string | null;
  themeColorSecondary: string | null;
  /** null = master brand; set = the organization's own local brand */
  organizationId: string | null;
  _count?: { products: number };
}

// Logos vary from square marks to wide wordmarks: fit them uncropped in a 2:1 box
export const BrandLogo = ({ brand, height }: { brand: Pick<BrandRecord, "name" | "imageUrl">; height: number }) =>
  brand.imageUrl ? (
    <img
      src={brand.imageUrl}
      alt={brand.name}
      style={{ width: height * 2, height, objectFit: "contain", flexShrink: 0 }}
    />
  ) : (
    <Avatar shape="square" size={height} style={{ width: height * 2, flexShrink: 0 }}>{brand.name[0]}</Avatar>
  );

export const BrandScopeTag = ({ brand }: { brand: BrandRecord }) =>
  brand.organizationId ? <Tag color="purple">Local</Tag> : <Tag color="blue">Master</Tag>;

/** Master brands belong to the platform admin; local brands to members of their organization with the brands permission */
export function useCanEditBrand() {
  const { data: identity } = useGetIdentity<PermissionSubject & { organizationId?: string }>();
  return (brand: BrandRecord) => canEditCatalogRecord(identity, "brands", brand);
}

/** Logo, name, scope and colours, with Edit for those who may change the brand */
export const BrandHeader = ({ brand, productCount }: { brand: BrandRecord; productCount: number }) => {
  const canEdit = useCanEditBrand();
  return (
  <Flex gap={16} align="center">
    <BrandLogo brand={brand} height={64} />
    <div style={{ flex: 1 }}>
      <Title level={4} style={{ margin: 0 }}>{brand.name} <BrandScopeTag brand={brand} /></Title>
      <Text type="secondary">{brand.slug} · {productCount} products</Text>
      {brand.themeColor && (
        <Flex gap={4} style={{ marginTop: 4 }}>
          {[brand.themeColor, brand.themeColorSecondary].filter(Boolean).map((c) => (
            <span key={c} title={c!} style={{ width: 16, height: 16, borderRadius: 4, background: c!, border: "1px solid #e2e8f0" }} />
          ))}
        </Flex>
      )}
    </div>
    {canEdit(brand) && <EditButton size="small" recordItemId={brand.id} resource="brands" />}
  </Flex>
  );
};
