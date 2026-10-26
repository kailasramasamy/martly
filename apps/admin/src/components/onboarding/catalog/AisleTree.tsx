import { useMemo, useState } from "react";
import { Input, Tree, Typography } from "antd";
import type { DataNode } from "antd/es/tree";
import { SearchOutlined } from "@ant-design/icons";
import type { CatalogRules } from "@martly/shared/schemas";
import type { ProposalAisle, ProposalDepartment } from "@martly/shared/types";

const { Text } = Typography;

interface Props {
  departments: ProposalDepartment[];
  /** Tiers the store's size carries; aisles in them are in unless excluded */
  sizeTiers: string[];
  rules: CatalogRules;
  selectedId?: string;
  onSelect: (aisleId: string) => void;
  onRulesChange: (rules: Pick<CatalogRules, "excludedSubcategoryIds" | "includedSubcategoryIds">) => void;
}

const label = (name: string, products: number, muted = false) => (
  <span style={{ opacity: muted ? 0.55 : 1 }}>
    {name} {products > 0 && <Text type="secondary" style={{ fontSize: 12 }}>{products.toLocaleString("en-IN")}</Text>}
  </span>
);

function toNodes(departments: ProposalDepartment[], filter: string): DataNode[] {
  const match = (a: ProposalAisle) => !filter || a.name.toLowerCase().includes(filter);
  const sum = (aisles: ProposalAisle[]) => aisles.reduce((n, a) => n + (a.included ? a.products : 0), 0);
  return departments.map((d) => {
    const categories = d.categories.map((c) => ({ c, aisles: c.aisles.filter(match) })).filter((x) => x.aisles.length > 0);
    return {
      key: d.id,
      title: label(d.name, categories.reduce((n, x) => n + sum(x.aisles), 0)),
      children: categories.map(({ c, aisles }) => ({
        key: c.id,
        title: label(c.name, sum(aisles)),
        children: aisles.map((a) => ({ key: a.id, isLeaf: true, title: label(a.name, a.included ? a.products : a.available, !a.included) })),
      })),
    };
  }).filter((d) => (d.children?.length ?? 0) > 0);
}

/** Every aisle with what the store would carry; ticking adds an aisle, unticking drops it */
export function AisleTree({ departments, sizeTiers, rules, selectedId, onSelect, onRulesChange }: Props) {
  const [filter, setFilter] = useState("");
  const aisles = useMemo(() => departments.flatMap((d) => d.categories.flatMap((c) => c.aisles)), [departments]);
  const nodes = useMemo(() => toNodes(departments, filter.trim().toLowerCase()), [departments, filter]);
  const checked = aisles.filter((a) => a.included).map((a) => a.id);
  const [expanded, setExpanded] = useState<React.Key[]>(() => departments.slice(0, 3).map((d) => d.id));
  const matchedKeys = useMemo(() => nodes.flatMap((d) => [d.key, ...d.children!.map((c) => c.key)]), [nodes]);
  const toggle = (key: React.Key) => setExpanded((keys) => (keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]));

  const onCheck = (keys: React.Key[] | { checked: React.Key[] }) => {
    const on = new Set((Array.isArray(keys) ? keys : keys.checked).map(String));
    // Filtered-out aisles keep their state
    const visible = new Set(nodes.flatMap((d) => d.children!.flatMap((c) => c.children!.map((a) => String(a.key)))));
    const isOn = (a: ProposalAisle) => (visible.has(a.id) ? on.has(a.id) : a.included);
    const base = (a: ProposalAisle) => sizeTiers.includes(a.tier);
    onRulesChange({
      excludedSubcategoryIds: aisles.filter((a) => base(a) && !isOn(a)).map((a) => a.id),
      includedSubcategoryIds: aisles.filter((a) => !base(a) && isOn(a)).map((a) => a.id),
    });
  };

  return (
    <div>
      <Input allowClear prefix={<SearchOutlined />} placeholder="Find an aisle" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ marginBottom: 8 }} />
      <div style={{ maxHeight: 560, overflow: "auto" }}>
        <Tree
          checkable
          blockNode
          treeData={nodes}
          checkedKeys={checked}
          selectedKeys={selectedId ? [selectedId] : []}
          expandedKeys={filter ? matchedKeys : expanded}
          onExpand={(keys) => !filter && setExpanded(keys)}
          onCheck={onCheck}
          onSelect={(_, { node }) => (node.isLeaf ? onSelect(String(node.key)) : !filter && toggle(node.key))}
        />
      </div>
      {rules.excludedSubcategoryIds.length + rules.includedSubcategoryIds.length > 0 && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {rules.excludedSubcategoryIds.length} aisles dropped, {rules.includedSubcategoryIds.length} added beyond the size
        </Text>
      )}
    </div>
  );
}
