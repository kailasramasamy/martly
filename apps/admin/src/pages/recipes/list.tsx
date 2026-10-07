import { List, useTable, EditButton, DeleteButton } from "@refinedev/antd";
import { Table, Space, Input, Tag, Switch } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import type { HttpError } from "@refinedev/core";
import { useUpdate } from "@refinedev/core";

const DIFFICULTY_COLORS: Record<string, string> = {
  EASY: "green",
  MEDIUM: "orange",
  HARD: "red",
};

const DIET_COLORS: Record<string, string> = {
  VEG: "green",
  NON_VEG: "red",
  VEGAN: "lime",
  EGG: "gold",
};

interface RecipeRecord {
  id: string;
  title: string;
  slug: string;
  cuisineType: string | null;
  difficulty: string | null;
  dietType: string | null;
  isActive: boolean;
  sortOrder: number;
  organizationId: string | null;
  organization: { id: string; name: string } | null;
  _count: { items: number };
}

export const RecipeList = () => {
  const { tableProps, searchFormProps } = useTable<RecipeRecord, HttpError, { q: string }>({
    resource: "recipes",
    sorters: { initial: [{ field: "sortOrder", order: "asc" }] },
    onSearch: (values) => [
      { field: "q", operator: "eq", value: values.q },
    ],
  });

  const { mutate: update } = useUpdate();

  return (
    <List>
      <div style={{ marginBottom: 16 }}>
        <Input.Search
          placeholder="Search recipes..."
          allowClear
          prefix={<SearchOutlined />}
          onSearch={(value) => searchFormProps.onFinish?.({ q: value })}
          onChange={(e) => {
            if (!e.target.value) searchFormProps.onFinish?.({ q: "" });
          }}
          style={{ maxWidth: 360 }}
        />
      </div>
      <Table {...tableProps} rowKey="id">
        <Table.Column dataIndex="title" title="Title" />
        <Table.Column dataIndex="cuisineType" title="Cuisine" render={(v: string | null) => v || "—"} />
        <Table.Column
          dataIndex="difficulty"
          title="Difficulty"
          render={(v: string | null) =>
            v ? <Tag color={DIFFICULTY_COLORS[v] ?? "default"}>{v}</Tag> : "—"
          }
        />
        <Table.Column
          dataIndex="dietType"
          title="Diet"
          render={(v: string | null) =>
            v ? <Tag color={DIET_COLORS[v] ?? "default"}>{v.replace("_", " ")}</Tag> : "—"
          }
        />
        <Table.Column
          dataIndex={["_count", "items"]}
          title="Ingredients"
          render={(v: number) => <Tag color="blue">{v}</Tag>}
        />
        <Table.Column
          dataIndex="isActive"
          title="Active"
          width={80}
          render={(v: boolean, record: RecipeRecord) => (
            <Switch
              checked={v}
              size="small"
              onChange={(checked) =>
                update({
                  resource: "recipes",
                  id: record.id,
                  values: { isActive: checked },
                  mutationMode: "optimistic",
                })
              }
            />
          )}
        />
        <Table.Column
          title="Actions"
          render={(_, record: RecipeRecord) => (
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
