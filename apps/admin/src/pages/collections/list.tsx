import { List, useTable, EditButton, DeleteButton } from "@refinedev/antd";
import { Table, Space, Tag, Switch, Tooltip } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import type { HttpError } from "@refinedev/core";
import { useUpdate } from "@refinedev/core";
import dayjs from "dayjs";
import { CollectionKindLabels, type CollectionKind } from "@martly/shared/constants";
import { DebouncedSearch } from "../../components/DebouncedSearch";

interface CollectionRecord {
  id: string;
  title: string;
  subtitle: string | null;
  slug: string;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  kind: CollectionKind;
  source: "MANUAL" | "AGENT";
  startsAt: string | null;
  endsAt: string | null;
  organizationId: string | null;
  organization: { id: string; name: string } | null;
  heroImageUrl: string | null;
  heroTheme: { background: string; title: string } | null;
  liveFestival: boolean;
  _count: { items: number };
}

const getStatus = (r: CollectionRecord) => {
  if (!r.isActive) return { color: "default", label: "Inactive" };
  const now = dayjs();
  if (r.startsAt && dayjs(r.startsAt).isAfter(now)) return { color: "blue", label: "Scheduled" };
  if (r.endsAt && dayjs(r.endsAt).isBefore(now)) return { color: "default", label: "Expired" };
  return { color: "green", label: "Active now" };
};

/** Marks a collection with a Home hero, and the one Home's "Live festival" card shows right now */
const HeroTag = ({ record }: { record: CollectionRecord }) => {
  const style = record.heroTheme ? { background: record.heroTheme.background, color: record.heroTheme.title, borderColor: record.heroTheme.title } : undefined;
  if (!record.liveFestival) {
    return <Tooltip title="Can lead Home's Live festival card while its dates are on"><Tag style={style}>Home hero</Tag></Tooltip>;
  }
  return (
    <Tooltip title="Home's Live festival card shows this now. A store that stocks none of its aisles shows the next live one.">
      <Tag style={style}>● Live festival</Tag>
    </Tooltip>
  );
};

export const CollectionList = () => {
  const { tableProps, searchFormProps } = useTable<CollectionRecord, HttpError, { q: string }>({
    resource: "collections",
    pagination: { pageSize: 25 },
    sorters: { initial: [{ field: "sortOrder", order: "asc" }] },
    onSearch: (values) => [
      { field: "q", operator: "eq", value: values.q },
    ],
  });

  const { mutate: update } = useUpdate();

  return (
    <List>
      <div style={{ marginBottom: 16 }}>
        <DebouncedSearch
          placeholder="Search collections, or live / home hero"
          prefix={<SearchOutlined />}
          onSearch={(q) => searchFormProps.onFinish?.({ q })}
          style={{ maxWidth: 360 }}
        />
      </div>
      <Table {...tableProps} rowKey="id">
        <Table.Column
          dataIndex="title"
          title="Title"
          render={(v: string, record: CollectionRecord) => (
            <Space size={8}>
              {v}
              {record.source === "AGENT" && <Tag color="purple">Auto-curated</Tag>}
              {record.heroImageUrl && <HeroTag record={record} />}
            </Space>
          )}
        />
        <Table.Column dataIndex="subtitle" title="Subtitle" render={(v: string | null) => v || "—"} />
        <Table.Column
          dataIndex={["_count", "items"]}
          title="Products"
          render={(v: number) => <Tag color="blue">{v}</Tag>}
        />
        <Table.Column dataIndex="sortOrder" title="Sort Order" width={100} />
        <Table.Column
          dataIndex="isActive"
          title="Active"
          width={80}
          render={(v: boolean, record: CollectionRecord) => (
            <Switch
              checked={v}
              size="small"
              onChange={(checked) =>
                update({
                  resource: "collections",
                  id: record.id,
                  values: { isActive: checked },
                  mutationMode: "optimistic",
                })
              }
            />
          )}
        />
        <Table.Column
          dataIndex="kind"
          title="Kind"
          render={(v: CollectionKind) => <Tag>{CollectionKindLabels[v]}</Tag>}
        />
        <Table.Column
          title="Status"
          render={(_: unknown, record: CollectionRecord) => {
            const { color, label } = getStatus(record);
            return <Tag color={color}>{label}</Tag>;
          }}
        />
        <Table.Column
          title="Scope"
          render={(_: unknown, record: CollectionRecord) =>
            record.organizationId ? (
              <Tag color="cyan">{record.organization?.name ?? "Org"}</Tag>
            ) : (
              <Tag color="purple">Global</Tag>
            )
          }
        />
        <Table.Column
          title="Actions"
          render={(_, record: CollectionRecord) => (
            <Space>
              <EditButton hideText size="small" recordItemId={record.id} />
              <DeleteButton hideText size="small" recordItemId={record.id} />
            </Space>
          )}
        />
      </Table>
    </List>
  );
};
