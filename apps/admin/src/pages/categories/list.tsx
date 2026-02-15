import { useState, useCallback, useEffect } from "react";
import { List, EditButton, DeleteButton } from "@refinedev/antd";
import { Table, Space, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { HolderOutlined } from "@ant-design/icons";
import { useCustom } from "@refinedev/core";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { axiosInstance } from "../../providers/data-provider";

interface CategoryTreeNode {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  sortOrder: number;
  imageUrl: string | null;
  children: CategoryTreeNode[];
}

// --- Pure helper functions ---

function getDepth(
  nodes: CategoryTreeNode[],
  targetId: string,
  depth: number = 0,
): number {
  for (const node of nodes) {
    if (node.id === targetId) return depth;
    if (node.children.length > 0) {
      const result = getDepth(node.children, targetId, depth + 1);
      if (result !== -1) return result;
    }
  }
  return -1;
}

function flattenIds(nodes: CategoryTreeNode[]): string[] {
  const ids: string[] = [];
  for (const node of nodes) {
    ids.push(node.id);
    if (node.children.length > 0) {
      ids.push(...flattenIds(node.children));
    }
  }
  return ids;
}

function findParentId(
  nodes: CategoryTreeNode[],
  targetId: string,
  parentId: string | null = null,
): string | null | undefined {
  for (const node of nodes) {
    if (node.id === targetId) return parentId;
    if (node.children.length > 0) {
      const result = findParentId(node.children, targetId, node.id);
      if (result !== undefined) return result;
    }
  }
  return undefined;
}

function getSiblings(
  nodes: CategoryTreeNode[],
  nodeId: string,
): CategoryTreeNode[] | undefined {
  for (const node of nodes) {
    if (node.id === nodeId) return nodes;
    if (node.children.length > 0) {
      const result = getSiblings(node.children, nodeId);
      if (result) return result;
    }
  }
  return undefined;
}

function reorderSiblings(
  nodes: CategoryTreeNode[],
  activeId: string,
  overId: string,
): CategoryTreeNode[] {
  // Check if activeId is a direct child at this level
  const activeIndex = nodes.findIndex((n) => n.id === activeId);
  const overIndex = nodes.findIndex((n) => n.id === overId);

  if (activeIndex !== -1 && overIndex !== -1) {
    const reordered = [...nodes];
    const [moved] = reordered.splice(activeIndex, 1);
    reordered.splice(overIndex, 0, moved);
    return reordered.map((n, idx) => ({ ...n, sortOrder: idx }));
  }

  // Recurse into children
  return nodes.map((node) => {
    if (node.children.length === 0) return node;
    const updated = reorderSiblings(node.children, activeId, overId);
    if (updated === node.children) return node;
    return { ...node, children: updated };
  });
}

// --- Components ---

const DragHandle = ({ id }: { id: string }) => {
  const { listeners, setActivatorNodeRef } = useSortable({ id });
  return (
    <HolderOutlined
      ref={setActivatorNodeRef}
      {...listeners}
      style={{ cursor: "grab", color: "#999" }}
    />
  );
};

const SortableRow = (
  props: React.HTMLAttributes<HTMLTableRowElement> & {
    "data-row-key"?: string;
  },
) => {
  const id = props["data-row-key"] ?? "";
  const { setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style: React.CSSProperties = {
    ...props.style,
    transform: CSS.Translate.toString(transform),
    transition,
    ...(isDragging
      ? { position: "relative", zIndex: 9999, background: "#fafafa" }
      : {}),
  };

  return <tr {...props} ref={setNodeRef} style={style} />;
};

// --- Main component ---

export const CategoryList = () => {
  const { data, isLoading, refetch } = useCustom<{
    data: CategoryTreeNode[];
  }>({
    url: "/categories/tree",
    method: "get",
  });

  const [treeData, setTreeData] = useState<CategoryTreeNode[]>([]);

  useEffect(() => {
    if (data?.data?.data) {
      setTreeData(data.data.data);
    }
  }, [data]);

  const handleRefetch = useCallback(() => {
    refetch();
  }, [refetch]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeParent = findParentId(treeData, active.id as string);
    const overParent = findParentId(treeData, over.id as string);

    if (activeParent === undefined || overParent === undefined) return;

    if (activeParent !== overParent) {
      message.warning("Categories can only be reordered within the same level");
      return;
    }

    const prevTree = treeData;
    const newTree = reorderSiblings(treeData, active.id as string, over.id as string);
    setTreeData(newTree);

    // Build payload from the affected sibling group
    const siblings = getSiblings(newTree, active.id as string);
    if (!siblings) return;

    const items = siblings.map((cat, idx) => ({ id: cat.id, sortOrder: idx }));

    try {
      await axiosInstance.post("/categories/reorder", { items });
    } catch {
      message.error("Failed to save order");
      setTreeData(prevTree);
    }
  };

  const columns: ColumnsType<CategoryTreeNode> = [
    {
      title: "Name",
      render: (_, record) => {
        const depth = getDepth(treeData, record.id);
        return (
          <div style={{ display: "flex", alignItems: "center", paddingLeft: depth * 24 }}>
            <DragHandle id={record.id} />
            {record.imageUrl && (
              <img
                src={record.imageUrl}
                alt=""
                style={{ width: 28, height: 28, borderRadius: 4, objectFit: "cover", marginLeft: 8 }}
              />
            )}
            <span style={{ marginLeft: 8 }}>{record.name}</span>
          </div>
        );
      },
    },
    Table.EXPAND_COLUMN,
    { dataIndex: "slug", title: "Slug" },
    {
      title: "Sub-categories",
      align: "center",
      render: (_, record) => record.children.length || "—",
    },
    { dataIndex: "sortOrder", title: "Sort Order" },
    {
      title: "Actions",
      render: (_, record) => (
        <Space>
          <EditButton hideText size="small" recordItemId={record.id} />
          <DeleteButton
            hideText
            size="small"
            recordItemId={record.id}
            onSuccess={handleRefetch}
          />
        </Space>
      ),
    },
  ];

  return (
    <List>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={flattenIds(treeData)}
          strategy={verticalListSortingStrategy}
        >
          <Table<CategoryTreeNode>
            dataSource={treeData}
            loading={isLoading}
            rowKey="id"
            childrenColumnName="children"
            components={{ body: { row: SortableRow } }}
            pagination={false}
            columns={columns}
          />
        </SortableContext>
      </DndContext>
    </List>
  );
};
