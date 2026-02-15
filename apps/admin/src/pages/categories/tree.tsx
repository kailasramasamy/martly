import { useCustom } from "@refinedev/core";
import { List } from "@refinedev/antd";
import { Tree, Spin } from "antd";
import type { DataNode } from "antd/es/tree";

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
    url: `${import.meta.env.VITE_API_URL}/api/v1/categories/tree`,
    method: "get",
  });

  const treeNodes = data?.data?.data ? toTreeData(data.data.data) : [];

  return (
    <List title="Category Tree" canCreate={false}>
      {isLoading ? (
        <Spin />
      ) : treeNodes.length === 0 ? (
        <p>No categories yet.</p>
      ) : (
        <Tree treeData={treeNodes} defaultExpandAll showLine />
      )}
    </List>
  );
};
