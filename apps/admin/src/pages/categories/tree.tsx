import { useCustom } from "@refinedev/core";
import { List } from "@refinedev/antd";
import { Tree, Spin, Card } from "antd";
import type { DataNode } from "antd/es/tree";
import { ApartmentOutlined } from "@ant-design/icons";

import { sectionTitle } from "../../theme";

interface CategoryTreeNode {
  id: string;
  name: string;
  slug: string;
  children: CategoryTreeNode[];
}

function toTreeData(nodes: CategoryTreeNode[]): DataNode[] {
  return nodes.map((n) => ({
    key: n.id,
    title: `${n.name} (${n.slug})`,
    children: n.children.length > 0 ? toTreeData(n.children) : undefined,
  }));
}

export const CategoryTree = () => {
  const { data, isLoading } = useCustom<{ data: CategoryTreeNode[] }>({
    url: "/categories/tree",
    method: "get",
  });

  const treeNodes = data?.data?.data ? toTreeData(data.data.data) : [];

  return (
    <List title="Category Tree" canCreate={false}>
      <Card title={sectionTitle(<ApartmentOutlined />, "Hierarchy")} size="small">
        {isLoading ? (
          <Spin />
        ) : treeNodes.length === 0 ? (
          <p>No categories yet.</p>
        ) : (
          <Tree treeData={treeNodes} defaultExpandAll showLine />
        )}
      </Card>
    </List>
  );
};
