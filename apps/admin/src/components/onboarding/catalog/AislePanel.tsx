import { Button, Empty, Image, Space, Spin, Switch, Table, Tag, Tooltip, Typography } from "antd";
import { StarFilled } from "@ant-design/icons";
import type { CatalogRules } from "@martly/shared/schemas";
import type { ProposalAisle, ProposalBrand, ProposalProduct } from "@martly/shared/types";

const { Text, Title } = Typography;

type BrandRules = Pick<CatalogRules, "excludedBrandIds" | "includedBrandIds">;

interface Props {
  aisle?: ProposalAisle;
  products?: ProposalProduct[];
  otherBrands?: (ProposalBrand & { eligible: boolean })[];
  loading: boolean;
  rules: CatalogRules;
  onRulesChange: (rules: BrandRules) => void;
}

const regionalMark = <Tooltip title="Regional brand"><StarFilled style={{ color: "#f59e0b", fontSize: 11 }} /></Tooltip>;
const toggle = (list: string[], id: string, on: boolean) => (on ? [...new Set([...list, id])] : list.filter((x) => x !== id));

function sizesLabel(p: ProposalProduct) {
  return p.variants.map((v) => (
    <Tag key={v.id} color={v.listed ? "green" : v.mrp === null ? "gold" : undefined} style={{ marginBottom: 2 }}>
      {v.name} · {v.mrp === null ? "needs price" : `₹${v.mrp.toLocaleString("en-IN")}`}
    </Tag>
  ));
}

function BrandList({ aisle, otherBrands = [], rules, onRulesChange }: Pick<Props, "otherBrands" | "rules" | "onRulesChange"> & { aisle: ProposalAisle }) {
  const set = (id: string, keep: boolean) => onRulesChange({
    excludedBrandIds: toggle(rules.excludedBrandIds, id, !keep),
    includedBrandIds: toggle(rules.includedBrandIds, id, keep && !rules.excludedBrandIds.includes(id)),
  });
  return (
    <div style={{ marginBottom: 12 }}>
      <Space wrap size={[8, 8]}>
        {aisle.brands.map((b) => (
          <Tag key={b.id ?? "loose"} style={{ padding: "4px 8px" }}>
            <Space size={6}>
              {b.id && <Switch size="small" checked onChange={() => set(b.id!, false)} />}
              {b.regional && regionalMark}{b.name} <Text type="secondary">{b.products}</Text>
            </Space>
          </Tag>
        ))}
      </Space>
      {otherBrands.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <Text type="secondary" style={{ fontSize: 12, marginRight: 8 }}>Also in this aisle:</Text>
          {otherBrands.slice(0, 12).map((b) => b.id && (
            <Tooltip key={b.id} title={b.eligible ? "Below the brand cap" : rules.excludedBrandIds.includes(b.id) ? "Hidden everywhere" : "Another region's brand"}>
              <Button size="small" type="dashed" style={{ margin: "0 6px 6px 0" }} onClick={() => set(b.id!, true)}>
                + {b.regional && regionalMark} {b.name} ({b.products})
              </Button>
            </Tooltip>
          ))}
        </div>
      )}
      <Text type="secondary" style={{ fontSize: 12 }}>Switching a brand off hides it in every aisle; adding one carries it everywhere it sells.</Text>
    </div>
  );
}

/** One aisle: the brands it carries (switchable) and the products picked from them */
export function AislePanel({ aisle, products, otherBrands, loading, rules, onRulesChange }: Props) {
  if (!aisle) return <Empty description="Pick an aisle to see its brands and products" style={{ marginTop: 80 }} />;
  return (
    <Spin spinning={loading}>
      <Space align="baseline" style={{ marginBottom: 8 }}>
        <Title level={5} style={{ margin: 0 }}>{aisle.name}</Title>
        <Tag>{aisle.tier.toLowerCase()}</Tag>
        {!aisle.included && <Tag color="default">Not carried</Tag>}
        <Text type="secondary">{aisle.products} of {aisle.available} products ({aisle.likely} visible) · {aisle.variants} sizes</Text>
      </Space>
      <BrandList aisle={aisle} otherBrands={otherBrands} rules={rules} onRulesChange={onRulesChange} />
      <Table<ProposalProduct> rowKey="id" size="small" dataSource={products} pagination={{ pageSize: 25, hideOnSinglePage: true }}>
        <Table.Column<ProposalProduct> width={56} render={(_, p) => p.imageUrl && <Image src={p.imageUrl} width={40} height={40} style={{ objectFit: "contain" }} preview={false} />} />
        <Table.Column<ProposalProduct> title="Product" render={(_, p) => (
          <Space size={6}>{p.name}{!p.likely && <Tooltip title="Listed hidden until the store confirms it in Stock check"><Tag>Suggestion</Tag></Tooltip>}</Space>
        )} />
        <Table.Column<ProposalProduct> title="Brand" render={(_, p) => p.brand ? <Space size={4}>{p.brand.regional && regionalMark}{p.brand.name}</Space> : <Text type="secondary">Loose</Text>} />
        <Table.Column<ProposalProduct> title="Sizes · MRP" render={(_, p) => sizesLabel(p)} />
      </Table>
    </Spin>
  );
}
