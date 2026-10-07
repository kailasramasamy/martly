import { useCustom } from "@refinedev/core";
import { List } from "@refinedev/antd";
import { Tree, Spin, Card } from "antd";
import type { DataNode } from "antd/es/tree";
import { ApartmentOutlined } from "@ant-design/icons";
import { sectionTitle } from "../../theme";

interface SubcategoryNode { id: string; name: string; slug: string; }
interface CategoryNode { id: string; name: string; slug: string; subcategories: SubcategoryNode[]; }
interface DepartmentNode { id: string; name: string; slug: string; categories: CategoryNode[]; }

function toTreeData(departments: DepartmentNode[]): DataNode[] {
  return departments.map((d) => ({
    key: d.id,
    title: `${d.name} (${d.slug})`,
    children: d.categories.map((c) => ({
      key: c.id,
      title: `${c.name} (${c.slug})`,
      children: c.subcategories.map((s) => ({
        key: s.id,
        title: `${s.name} (${s.slug})`,
      })),
    })),
  }));
}

export const CategoryTree = () => {
  const { data, isLoading } = useCustom<{ data: DepartmentNode[] }>({
    url: "/categories/tree",
    method: "get",
  });

  const treeNodes = data?.data?.data ? toTreeData(data.data.data) : [];

  return (
    <List title="Category Tree" canCreate={false}>
      <Card title={sectionTitle(<ApartmentOutlined />, "3-Tier Hierarchy")} size="small">
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
