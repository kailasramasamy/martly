import { useCallback, useEffect, useState } from "react";
import { List, useTable, EditButton, DeleteButton } from "@refinedev/antd";
import { Table, Space, App } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import type { HttpError } from "@refinedev/core";
import { isAxiosError } from "axios";
import type { BrandSegment, BrandSummary } from "@martly/shared/types";
import { Link } from "react-router";
import { BrandLogo, BrandScopeTag, useCanEditBrand, type BrandRecord } from "./brand-parts";
import { DebouncedSearch } from "../../components/DebouncedSearch";
import { axiosInstance } from "../../providers/data-provider";
import { BrandKpiCards } from "./kpi-cards";

export const BrandList = () => {
  const { tableProps, searchFormProps, setFilters } = useTable<BrandRecord, HttpError, { q: string }>({
    resource: "brands",
    sorters: { initial: [{ field: "name", order: "asc" }] },
    pagination: { pageSize: 25 },
    onSearch: (values) => [
      { field: "q", operator: "eq", value: values.q },
    ],
  });
  const [summary, setSummary] = useState<BrandSummary | null>(null);
  const [segment, setSegment] = useState<BrandSegment | null>(null);
  const { message } = App.useApp();
  const canEdit = useCanEditBrand();

  const refreshSummary = useCallback(() => {
    axiosInstance.get("/brands/summary")
      .then(({ data }) => setSummary(data.data))
      .catch((err) => {
        if (!isAxiosError(err)) throw err;
        message.error("Failed to load brand summary");
      });
  }, [message]);

  useEffect(refreshSummary, [refreshSummary]);

  const showSegment = (next: BrandSegment | null) => {
    setSegment(next);
    setFilters([{ field: "segment", operator: "eq", value: next ?? undefined }]);
  };

  return (
    <List>
      <BrandKpiCards summary={summary} segment={segment} onSegment={showSegment} />
      <div style={{ marginBottom: 16 }}>
        <DebouncedSearch
          placeholder="Search brands..."
          prefix={<SearchOutlined />}
          onSearch={(q) => searchFormProps.onFinish?.({ q })}
          style={{ maxWidth: 360 }}
        />
      </div>
      <Table {...tableProps} rowKey="id">
        <Table.Column
          dataIndex="name"
          title="Name"
          render={(name: string, record: BrandRecord) => (
            <Link to={`/brands/show/${record.id}`}>
              <Space>
                <BrandLogo brand={record} height={32} />
                {name}
                <BrandScopeTag brand={record} />
              </Space>
            </Link>
          )}
        />
        <Table.Column dataIndex="slug" title="Slug" />
        <Table.Column title="Products" render={(_, record: BrandRecord) => record._count?.products} />
        <Table.Column
          title="Actions"
          render={(_, record: BrandRecord) => canEdit(record) && (
            <Space>
              <EditButton hideText size="small" recordItemId={record.id} />
              <DeleteButton hideText size="small" recordItemId={record.id} onSuccess={refreshSummary} />
            </Space>
          )}
        />
      </Table>
    </List>
  );
};
