import { useState, useCallback, useMemo, useEffect } from "react";
import { List, EditButton, DeleteButton } from "@refinedev/antd";
import { Table, Space, Tag, Input, Breadcrumb, Badge, message, theme as antTheme } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  HolderOutlined,
  HomeOutlined,
  RightOutlined,
  FolderOutlined,
  ShoppingOutlined,
} from "@ant-design/icons";
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

// ── Types ──────────────────────────────────────────

interface SubcategoryNode {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  imageUrl: string | null;
}

interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  imageUrl: string | null;
  subcategories: SubcategoryNode[];
}

interface DepartmentNode {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  imageUrl: string | null;
  categories: CategoryNode[];
}

type Level = "department" | "category" | "subcategory";

interface DisplayItem {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  imageUrl: string | null;
  level: Level;
  childCount: number;
  productCount?: number;
}

interface SearchResult extends DisplayItem {
  path: string;
  deptId?: string;
  catId?: string;
}

interface PathSegment {
  id: string;
  name: string;
}

// ── Helpers ────────────────────────────────────────

const LEVEL_COLORS: Record<Level, string> = {
  department: "blue",
  category: "green",
  subcategory: "default",
};

function searchTree(
  departments: DepartmentNode[],
  query: string,
  productCounts: Map<string, number>,
): SearchResult[] {
  const q = query.toLowerCase();
  const results: SearchResult[] = [];
  for (const d of departments) {
    if (d.name.toLowerCase().includes(q) || d.slug.toLowerCase().includes(q)) {
      results.push({
        id: d.id, name: d.name, slug: d.slug, sortOrder: d.sortOrder,
        imageUrl: d.imageUrl, level: "department", childCount: d.categories.length, path: "",
      });
    }
    for (const c of d.categories) {
      if (c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q)) {
        results.push({
          id: c.id, name: c.name, slug: c.slug, sortOrder: c.sortOrder,
          imageUrl: c.imageUrl, level: "category", childCount: c.subcategories.length,
          path: d.name, deptId: d.id,
        });
      }
      for (const s of c.subcategories) {
        if (s.name.toLowerCase().includes(q) || s.slug.toLowerCase().includes(q)) {
          results.push({
            id: s.id, name: s.name, slug: s.slug, sortOrder: s.sortOrder,
            imageUrl: s.imageUrl, level: "subcategory", childCount: 0,
            productCount: productCounts.get(s.id) ?? 0,
            path: `${d.name} › ${c.name}`, deptId: d.id, catId: c.id,
          });
        }
      }
    }
  }
  return results;
}

// ── Drag Components ────────────────────────────────

const DragHandle = ({ id }: { id: string }) => {
  const { listeners, setActivatorNodeRef } = useSortable({ id });
  const { token } = antTheme.useToken();
  return (
    <HolderOutlined
      ref={setActivatorNodeRef}
      {...listeners}
      style={{ cursor: "grab", color: token.colorTextQuaternary }}
    />
  );
};

const SortableRow = (
  props: React.HTMLAttributes<HTMLTableRowElement> & { "data-row-key"?: string },
) => {
  const id = props["data-row-key"] ?? "";
  const { setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const { token } = antTheme.useToken();
  const style: React.CSSProperties = {
    ...props.style,
    transform: CSS.Translate.toString(transform),
    transition,
    ...(isDragging ? { position: "relative", zIndex: 9999, background: token.colorBgElevated } : {}),
  };
  return <tr {...props} ref={setNodeRef} style={style} />;
};

// ── Main Component ─────────────────────────────────

export const CategoryList = () => {
  const { token } = antTheme.useToken();

  const { data, isLoading, refetch } = useCustom<{ data: DepartmentNode[] }>({
    url: "/categories/tree",
    method: "get",
  });
  const treeData = useMemo(() => data?.data?.data ?? [], [data]);

  const [path, setPath] = useState<PathSegment[]>([]);
  const [searchText, setSearchText] = useState("");
  const isSearching = searchText.length > 0;

  // Fetch product counts per subcategory
  const [productCounts, setProductCounts] = useState<Map<string, number>>(new Map());
  useEffect(() => {
    axiosInstance.get("/products/facets").then((res) => {
      const map = new Map<string, number>();
      for (const s of res.data?.data?.subcategories ?? []) {
        map.set(s.id, s.count);
      }
      setProductCounts(map);
    }).catch(() => {});
  }, []);

  // Stats
  const stats = useMemo(() => {
    let cats = 0, subcats = 0;
    for (const d of treeData) {
      cats += d.categories.length;
      for (const c of d.categories) subcats += c.subcategories.length;
    }
    return { departments: treeData.length, categories: cats, subcategories: subcats };
  }, [treeData]);

  // Current level items (drill-down mode)
  const currentItems = useMemo((): DisplayItem[] => {
    if (path.length === 0) {
      return treeData.map(d => ({
        id: d.id, name: d.name, slug: d.slug, sortOrder: d.sortOrder,
        imageUrl: d.imageUrl, level: "department" as Level, childCount: d.categories.length,
      }));
    }
    if (path.length === 1) {
      const dept = treeData.find(d => d.id === path[0].id);
      return (dept?.categories ?? []).map(c => ({
        id: c.id, name: c.name, slug: c.slug, sortOrder: c.sortOrder,
        imageUrl: c.imageUrl, level: "category" as Level, childCount: c.subcategories.length,
      }));
    }
    if (path.length === 2) {
      const dept = treeData.find(d => d.id === path[0].id);
      const cat = dept?.categories.find(c => c.id === path[1].id);
      return (cat?.subcategories ?? []).map(s => ({
        id: s.id, name: s.name, slug: s.slug, sortOrder: s.sortOrder,
        imageUrl: s.imageUrl, level: "subcategory" as Level, childCount: 0,
        productCount: productCounts.get(s.id) ?? 0,
      }));
    }
    return [];
  }, [treeData, path, productCounts]);

  // Search results
  const searchResults = useMemo(() => {
    if (!isSearching) return [];
    return searchTree(treeData, searchText, productCounts);
  }, [treeData, searchText, isSearching, productCounts]);

  const currentLevel: Level = path.length === 0 ? "department" : path.length === 1 ? "category" : "subcategory";

  // Drill down into a row
  const drillDown = (item: DisplayItem | SearchResult) => {
    if (item.childCount === 0) return;

    if (isSearching) {
      const sr = item as SearchResult;
      if (item.level === "department") {
        setPath([{ id: item.id, name: item.name }]);
      } else if (item.level === "category" && sr.deptId) {
        const dept = treeData.find(d => d.id === sr.deptId);
        if (dept) {
          setPath([
            { id: dept.id, name: dept.name },
            { id: item.id, name: item.name },
          ]);
        }
      }
      setSearchText("");
      return;
    }

    setPath([...path, { id: item.id, name: item.name }]);
  };

  // Breadcrumb navigation
  const navigateTo = (index: number) => {
    setPath(path.slice(0, index));
    setSearchText("");
  };

  // Drag reorder
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const items = [...currentItems];
    const activeIdx = items.findIndex(i => i.id === active.id);
    const overIdx = items.findIndex(i => i.id === over.id);
    if (activeIdx === -1 || overIdx === -1) return;

    const [moved] = items.splice(activeIdx, 1);
    items.splice(overIdx, 0, moved);

    const reorderItems = items.map((item, idx) => ({ id: item.id, sortOrder: idx }));

    try {
      await axiosInstance.post(`/categories/reorder?level=${currentLevel}`, { items: reorderItems });
      refetch();
    } catch {
      message.error("Failed to save order");
    }
  };

  const handleRefetch = useCallback(() => { refetch(); }, [refetch]);

  // ── Table title line ───────────────────────────────

  const title = isSearching
    ? `Search: "${searchText}" — ${searchResults.length} results`
    : path.length === 0
    ? `Departments (${stats.departments})`
    : path.length === 1
    ? `Categories in ${path[0].name} (${currentItems.length})`
    : `Subcategories in ${path[1].name} (${currentItems.length})`;

  // ── Shared cell renderers ──────────────────────────

  const renderImage = (imageUrl: string | null) =>
    imageUrl ? (
      <img src={imageUrl} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover" }} />
    ) : (
      <div style={{
        width: 32, height: 32, borderRadius: 6,
        background: token.colorFillQuaternary,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <FolderOutlined style={{ color: token.colorTextQuaternary }} />
      </div>
    );

  const renderProductCount = (count: number | undefined) => {
    if (count == null) return null;
    return (
      <Tag
        icon={<ShoppingOutlined />}
        style={{ marginLeft: 4, fontSize: 11 }}
      >
        {count} {count === 1 ? "product" : "products"}
      </Tag>
    );
  };

  const renderActions = (record: { id: string; level: Level }) => (
    <Space>
      <EditButton hideText size="small" recordItemId={record.id} />
      <DeleteButton
        hideText
        size="small"
        recordItemId={record.id}
        resource={
          record.level === "department" ? "categories/departments"
          : record.level === "subcategory" ? "categories/subcategories"
          : "categories"
        }
        onSuccess={handleRefetch}
      />
    </Space>
  );

  // ── Columns: drill-down mode ───────────────────────

  const drillColumns: ColumnsType<DisplayItem> = [
    {
      title: "",
      width: 36,
      render: (_, record) => <DragHandle id={record.id} />,
    },
    {
      title: "Name",
      render: (_, record) => (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {renderImage(record.imageUrl)}
          {record.childCount > 0 ? (
            <a onClick={() => drillDown(record)} style={{ fontWeight: 500 }}>
              {record.name}
            </a>
          ) : (
            <span>{record.name}</span>
          )}
          {record.childCount > 0 && (
            <Badge
              count={record.childCount}
              style={{
                backgroundColor: token.colorPrimaryBg,
                color: token.colorPrimary,
                fontSize: 11,
                boxShadow: "none",
              }}
            />
          )}
          {record.level === "subcategory" && renderProductCount(record.productCount)}
        </div>
      ),
    },
    { dataIndex: "slug", title: "Slug", width: 220 },
    {
      title: "Actions",
      width: 100,
      render: (_, record) => renderActions(record),
    },
  ];

  // ── Columns: search mode ───────────────────────────

  const searchColumns: ColumnsType<SearchResult> = [
    {
      title: "Name",
      render: (_, record) => (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {renderImage(record.imageUrl)}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {record.childCount > 0 ? (
                <a onClick={() => drillDown(record)} style={{ fontWeight: 500 }}>
                  {record.name}
                </a>
              ) : (
                <span style={{ fontWeight: 500 }}>{record.name}</span>
              )}
              {record.level === "subcategory" && renderProductCount(record.productCount)}
            </div>
            {record.path && (
              <div style={{ fontSize: 12, color: token.colorTextSecondary }}>{record.path}</div>
            )}
          </div>
        </div>
      ),
    },
    {
      title: "Level",
      width: 120,
      render: (_, record) => <Tag color={LEVEL_COLORS[record.level]}>{record.level}</Tag>,
    },
    {
      title: "Actions",
      width: 100,
      render: (_, record) => renderActions(record),
    },
  ];

  // ── Breadcrumb items ───────────────────────────────

  const breadcrumbItems = [
    {
      title: (
        <a onClick={() => navigateTo(0)} style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <HomeOutlined /> Departments
        </a>
      ),
    },
    ...path.map((seg, i) => ({
      title: i < path.length - 1 ? (
        <a onClick={() => navigateTo(i + 1)}>{seg.name}</a>
      ) : (
        <span style={{ fontWeight: 500 }}>{seg.name}</span>
      ),
    })),
  ];

  // ── Render ─────────────────────────────────────────

  return (
    <List title={title}>
      {/* Stats */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <Tag color="blue" style={{ cursor: "pointer" }} onClick={() => navigateTo(0)}>
          {stats.departments} Departments
        </Tag>
        <Tag color="green">{stats.categories} Categories</Tag>
        <Tag>{stats.subcategories} Subcategories</Tag>
      </div>

      {/* Breadcrumb + Search */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        {!isSearching && (
          <Breadcrumb items={breadcrumbItems} separator={<RightOutlined style={{ fontSize: 10 }} />} />
        )}
        {isSearching && <div />}
        <Input.Search
          placeholder="Search all categories..."
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          allowClear
          style={{ width: 280 }}
        />
      </div>

      {/* Table */}
      {isSearching ? (
        <Table<SearchResult>
          dataSource={searchResults}
          loading={isLoading}
          rowKey="id"
          columns={searchColumns}
          pagination={searchResults.length > 20 ? { pageSize: 20 } : false}
          size="small"
        />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={currentItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
            <Table<DisplayItem>
              dataSource={currentItems}
              loading={isLoading}
              rowKey="id"
              components={{ body: { row: SortableRow } }}
              pagination={currentItems.length > 30 ? { pageSize: 30 } : false}
              columns={drillColumns}
              size="small"
            />
          </SortableContext>
        </DndContext>
      )}
    </List>
  );
};
