import { useCallback, useEffect, useState } from "react";
import { Avatar, Button, Card, Popconfirm, Select, Space, Table, Tag, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { OrderedListOutlined } from "@ant-design/icons";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { FESTIVAL_REGIONS, type FestivalRegion } from "@martly/shared/constants";
import type { BrandRankingRow, BrandRankingSource } from "@martly/shared/types";
import type { BrandRankingLevel } from "@martly/shared/schemas";
import { sectionTitle } from "../../theme";
import { axiosInstance } from "../../providers/data-provider";
import { DragHandle, SortableRow } from "./list";

const SOURCE_TAGS: Record<BrandRankingSource, { color: string; label: string }> = {
  here: { color: "#0d9488", label: "Ranked" },
  allIndia: { color: "blue", label: "All India ranking" },
  category: { color: "geekblue", label: "Category ranking" },
  region: { color: "default", label: "Regional" },
  national: { color: "default", label: "National" },
};

const REGION_OPTIONS = Object.entries(FESTIVAL_REGIONS).map(([value, label]) => ({ value, label }));

const columns: ColumnsType<BrandRankingRow> = [
  { title: "", width: 36, render: (_, row) => <DragHandle id={row.id} /> },
  { title: "#", width: 48, render: (_, _row, index) => index + 1 },
  {
    title: "Logo",
    width: 140,
    render: (_, row) => (row.imageUrl
      ? <img src={row.imageUrl} alt="" style={{ height: 32, maxWidth: 120, objectFit: "contain", display: "block" }} />
      : <Avatar shape="square">{row.name.charAt(0)}</Avatar>),
  },
  { title: "Brand", dataIndex: "name", render: (name: string) => <span style={{ fontWeight: 500 }}>{name}</span> },
  { title: "Products", dataIndex: "products", width: 90 },
  {
    title: "Source",
    width: 200,
    render: (_, row) => {
      const { color, label } = SOURCE_TAGS[row.source];
      return (
        <Space size={4}>
          <Tag color={color} style={{ marginInlineEnd: 0 }}>{label}</Tag>
          <Typography.Text type="secondary" style={{ fontSize: 11 }}>{row.popularity}</Typography.Text>
        </Space>
      );
    },
  },
];

export const BrandRankingCard = ({ level, id }: { level: BrandRankingLevel; id: string }) => {
  const [region, setRegion] = useState<FestivalRegion>("ALL");
  const [rows, setRows] = useState<BrandRankingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const url = `/brand-ranking/${level}/${id}`;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get(url, { params: { region } });
      setRows(res.data.data);
      setDirty(false);
    } catch {
      message.error("Failed to load brand ranking");
    } finally {
      setLoading(false);
    }
  }, [url, region]);

  useEffect(() => { load(); }, [load]);

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = rows.findIndex((r) => r.id === active.id);
    const to = rows.findIndex((r) => r.id === over.id);
    if (from === -1 || to === -1) return;
    setRows(arrayMove(rows, from, to));
    setDirty(true);
  };

  const apply = async (request: Promise<{ data: { data: BrandRankingRow[] } }>, done: string) => {
    setLoading(true);
    try {
      setRows((await request).data.data);
      setDirty(false);
      message.success(done);
    } catch {
      message.error("Failed to update brand ranking");
    } finally {
      setLoading(false);
    }
  };

  const save = () =>
    apply(axiosInstance.put(url, { region, brandIds: rows.map((r) => r.id) }), "Order saved");
  const reset = () =>
    apply(axiosInstance.delete(url, { params: { region } }), "Ranking reset");

  const help =
    "Drag brands to rank them in this category. Saved per region; a region without its own order uses All India, then each brand's regional or national popularity.";

  return (
    <Card size="small" title={sectionTitle(<OrderedListOutlined />, "Brand ranking")}>
      <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>
        {help}
        {level === "subcategory" && " A subcategory's order overrides its category's."}
      </Typography.Paragraph>
      <Space style={{ marginBottom: 12 }} wrap>
        <Select<FestivalRegion>
          value={region}
          options={REGION_OPTIONS}
          onChange={setRegion}
          style={{ width: 180 }}
        />
        <Button type="primary" disabled={!dirty} loading={loading} onClick={save}>Save order</Button>
        <Popconfirm
          title={`Reset the ${FESTIVAL_REGIONS[region]} ranking?`}
          okText="Reset"
          onConfirm={reset}
        >
          <Button disabled={!rows.some((r) => r.source === "here")}>Reset</Button>
        </Popconfirm>
      </Space>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
          <Table<BrandRankingRow>
            dataSource={rows}
            loading={loading}
            rowKey="id"
            components={{ body: { row: SortableRow } }}
            columns={columns}
            pagination={false}
            size="small"
          />
        </SortableContext>
      </DndContext>
    </Card>
  );
};
