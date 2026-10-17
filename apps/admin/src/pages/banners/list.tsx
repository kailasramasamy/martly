import { List, useTable, EditButton, DeleteButton, ShowButton } from "@refinedev/antd";
import { useState } from "react";
import { Link } from "react-router";
import { useGetIdentity } from "@refinedev/core";
import { App, Table, Tag, Space, Image, Switch } from "antd";
import { isAxiosError } from "axios";
import { BANNER_PLACEMENT_CONFIG, BANNER_ACTION_TYPE_CONFIG } from "../../constants/tag-colors";
import { axiosInstance } from "../../providers/data-provider";
import dayjs from "dayjs";
import { SponsorTypeLabels, type SponsorType } from "@martly/shared/constants";
import { DebouncedSearch } from "../../components/DebouncedSearch";


export const BannerList = () => {
  const { tableProps, tableQuery, filters, setFilters } = useTable({
    resource: "banners",
    syncWithLocation: true,
    pagination: { pageSize: 25 },
  });
  const { message } = App.useApp();
  const { data: identity } = useGetIdentity<{ role: string }>();
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const handleToggleActive = async (id: string, checked: boolean) => {
    setTogglingId(id);
    try {
      await axiosInstance.put(`/banners/${id}`, { isActive: checked });
      await tableQuery.refetch();
    } catch (err) {
      if (!isAxiosError(err)) throw err;
      message.error(err.response?.data?.message ?? "Could not update the banner");
    } finally {
      setTogglingId(null);
    }
  };

  const currentSearch = (filters as any[])?.find((f: any) => f.field === "q")?.value || "";

  return (
    <List canCreate={identity?.role === "SUPER_ADMIN"}>
      <Space style={{ marginBottom: 16 }}>
        <DebouncedSearch
          placeholder="Search banners..."
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
        <Table.Column
          dataIndex="title"
          title="Title"
          render={(v: string, rec: any) => (
            <Space size={6}>
              {v}
              {rec.promo && <Tag color="purple">Promotion</Tag>}
            </Space>
          )}
        />
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
          dataIndex="sponsorType"
          title="Sponsor"
          render={(v: SponsorType) => <Tag color={v === "BRAND" ? "purple" : v === "PLATFORM" ? "geekblue" : "default"}>{SponsorTypeLabels[v] ?? v}</Tag>}
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
            <Switch size="small" checked={v} disabled={!!rec.promo || rec.sponsorType === "BRAND"} loading={togglingId === rec.id} onChange={(c) => handleToggleActive(rec.id, c)} />
          )}
        />
        <Table.Column
          title="Actions"
          width={130}
          render={(_, rec: any) => (
            <Space>
              <ShowButton hideText size="small" recordItemId={rec.id} title="View" />
              {rec.sponsorType === "BRAND" ? (
                // Brand banners belong to their brand campaign
                <Tag color="purple">Brand</Tag>
              ) : rec.promo ? (
                // Promotions own their banner; manage it from there
                <Link to={`/promos/show/${rec.promo.id}`}>Promotion</Link>
              ) : (
                <>
                  <EditButton hideText size="small" recordItemId={rec.id} />
                  <DeleteButton hideText size="small" recordItemId={rec.id} />
                </>
              )}
            </Space>
          )}
        />
      </Table>
    </List>
  );
};
