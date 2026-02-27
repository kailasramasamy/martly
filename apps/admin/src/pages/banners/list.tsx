import { List, useTable, EditButton, DeleteButton } from "@refinedev/antd";
import { Table, Tag, Space, Image, Switch, Input } from "antd";
import { BANNER_PLACEMENT_CONFIG, BANNER_ACTION_TYPE_CONFIG } from "../../constants/tag-colors";
import { axiosInstance } from "../../providers/data-provider";
import dayjs from "dayjs";

const { Search } = Input;

export const BannerList = () => {
  const { tableProps, setFilters, filters } = useTable({
    resource: "banners",
    syncWithLocation: true,
  });

  const handleToggleActive = async (id: string, checked: boolean) => {
    await axiosInstance.put(`/banners/${id}`, { isActive: checked });
    setFilters([], "replace");
  };

  const currentSearch = (filters as any[])?.find((f: any) => f.field === "q")?.value || "";

  return (
    <List>
      <Space style={{ marginBottom: 16 }}>
        <Search
          placeholder="Search banners..."
          allowClear
          defaultValue={currentSearch}
          onSearch={(value) =>
            setFilters([{ field: "q", operator: "eq", value: value || undefined }])
          }
          style={{ width: 300 }}
        />
      </Space>

      <Table {...tableProps} rowKey="id" size="small">
        <Table.Column
          title="Image"
          dataIndex="imageUrl"
          width={80}
          render={(url: string) =>
            url ? <Image src={url} width={60} height={40} style={{ objectFit: "cover", borderRadius: 4 }} preview /> : "—"
          }
        />
        <Table.Column dataIndex="title" title="Title" />
        <Table.Column
          dataIndex="placement"
          title="Placement"
          render={(v: string) => {
            const cfg = BANNER_PLACEMENT_CONFIG[v];
            return cfg ? <Tag color={cfg.color}>{cfg.label}</Tag> : v;
          }}
        />
        <Table.Column
          dataIndex="actionType"
          title="Action"
          render={(v: string) => {
            const cfg = BANNER_ACTION_TYPE_CONFIG[v];
            return cfg ? <Tag color={cfg.color}>{cfg.label}</Tag> : v;
          }}
        />
        <Table.Column dataIndex="sortOrder" title="Order" width={70} />
        <Table.Column
          title="Scope"
          render={(_, rec: any) => {
            if (rec.store) return <Tag color="blue">{rec.store.name}</Tag>;
            if (rec.organization) return <Tag color="green">{rec.organization.name}</Tag>;
            return <Tag>Global</Tag>;
          }}
        />
        <Table.Column
          title="Schedule"
          render={(_, rec: any) => {
            if (!rec.startsAt && !rec.endsAt) return <Tag>Always</Tag>;
            const start = rec.startsAt ? dayjs(rec.startsAt).format("MMM D") : "—";
            const end = rec.endsAt ? dayjs(rec.endsAt).format("MMM D") : "—";
            return <span style={{ fontSize: 12 }}>{start} → {end}</span>;
          }}
        />
        <Table.Column
          dataIndex="isActive"
          title="Active"
          width={70}
          render={(v: boolean, rec: any) => (
            <Switch size="small" checked={v} onChange={(c) => handleToggleActive(rec.id, c)} />
          )}
        />
        <Table.Column
          title="Actions"
          width={100}
          render={(_, rec: any) => (
            <Space>
              <EditButton hideText size="small" recordItemId={rec.id} />
              <DeleteButton hideText size="small" recordItemId={rec.id} />
            </Space>
          )}
        />
      </Table>
    </List>
  );
};
