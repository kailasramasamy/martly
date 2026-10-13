import { useState } from "react";
import { List, useTable, EditButton, DeleteButton } from "@refinedev/antd";
import { Table, Space, Tag, Button, App } from "antd";
import { ThunderboltOutlined } from "@ant-design/icons";
import type { HttpError } from "@refinedev/core";
import { Link, useNavigate } from "react-router";
import dayjs from "dayjs";
import { isAxiosError } from "axios";
import { CollectionKindLabels, FESTIVAL_REGIONS, type CollectionKind } from "@martly/shared/constants";
import { axiosInstance } from "../../providers/data-provider";

interface FestivalCollection {
  id: string;
  title: string;
  isActive: boolean;
  source: "MANUAL" | "AGENT";
  organizationId: string | null;
}

interface FestivalRecord {
  id: string;
  name: string;
  kind: CollectionKind;
  startsAt: string;
  endsAt: string;
  regions: string[];
  collections: FestivalCollection[];
}

interface CurateResult {
  organizationId: string;
  collectionId?: string;
  status: "created" | "exists" | "skipped";
  reason?: string;
}

const formatDate = (iso: string) => dayjs(iso).format("DD MMM YYYY");

const summarize = (results: CurateResult[]) => {
  const count = (status: CurateResult["status"]) => results.filter((r) => r.status === status).length;
  const reasons = results.filter((r) => r.status === "skipped" && r.reason).map((r) => r.reason);
  const parts = [`${count("created")} created`, `${count("exists")} already exist`, `${count("skipped")} skipped`];
  return reasons.length ? `${parts.join(", ")} (${reasons.join("; ")})` : parts.join(", ");
};

const findCollectionId = (results: CurateResult[], record: FestivalRecord) =>
  results.find((r) => r.collectionId)?.collectionId ??
  (results.some((r) => r.status === "exists")
    ? record.collections.find((c) => results.some((r) => r.status === "exists" && r.organizationId === c.organizationId))
        ?.id
    : undefined);

const CuratedStatus = ({ collections }: { collections: FestivalCollection[] }) => {
  if (collections.length === 0) return <Tag>Not curated</Tag>;
  return (
    <Space size={4} wrap>
      {collections.map((c) => (
        <Link key={c.id} to={`/collections/edit/${c.id}`}>
          <Tag color={c.isActive ? "green" : "red"}>
            {c.source === "AGENT" ? "AI " : ""}
            {c.isActive ? "Active" : "Vetoed"} — Review
          </Tag>
        </Link>
      ))}
    </Space>
  );
};

export const FestivalList = () => {
  const { tableProps, tableQueryResult } = useTable<FestivalRecord, HttpError>({
    resource: "festival-events",
    sorters: { initial: [{ field: "startsAt", order: "asc" }] },
  });
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [curatingId, setCuratingId] = useState<string | null>(null);

  const curate = async (record: FestivalRecord) => {
    setCuratingId(record.id);
    try {
      const { data } = await axiosInstance.post(`/festival-events/${record.id}/curate`, undefined, {
        timeout: 180000,
      });
      const results: CurateResult[] = data.data;
      const collectionId = findCollectionId(results, record);
      if (!collectionId) {
        message.warning(`${record.name}: ${summarize(results)}`);
        await tableQueryResult.refetch();
        return;
      }
      message.success(`${record.name}: ${summarize(results)}`);
      navigate(`/collections/edit/${collectionId}`);
    } catch (err) {
      if (!isAxiosError(err)) throw err;
      message.error(err.response?.data?.message ?? "Curation failed");
    } finally {
      setCuratingId(null);
    }
  };

  return (
    <List>
      <Table {...tableProps} rowKey="id">
        <Table.Column dataIndex="name" title="Name" />
        <Table.Column
          dataIndex="kind"
          title="Kind"
          render={(v: CollectionKind) => <Tag>{CollectionKindLabels[v]}</Tag>}
        />
        <Table.Column
          title="Dates"
          render={(_: unknown, r: FestivalRecord) => `${formatDate(r.startsAt)} – ${formatDate(r.endsAt)}`}
        />
        <Table.Column
          dataIndex="regions"
          title="Regions"
          render={(v: string[]) => (
            <Space size={4} wrap>
              {v.map((code) => (
                <Tag key={code}>{FESTIVAL_REGIONS[code as keyof typeof FESTIVAL_REGIONS] ?? code}</Tag>
              ))}
            </Space>
          )}
        />
        <Table.Column
          title="Curated"
          render={(_: unknown, r: FestivalRecord) => <CuratedStatus collections={r.collections} />}
        />
        <Table.Column
          title="Actions"
          render={(_: unknown, r: FestivalRecord) => (
            <Space>
              <Button
                size="small"
                icon={<ThunderboltOutlined />}
                loading={curatingId === r.id}
                disabled={curatingId !== null || dayjs(r.endsAt).isBefore(dayjs())}
                onClick={() => curate(r)}
              >
                Curate now
              </Button>
              <EditButton hideText size="small" recordItemId={r.id} />
              <DeleteButton hideText size="small" recordItemId={r.id} />
            </Space>
          )}
        />
      </Table>
    </List>
  );
};
