import { useState } from "react";
import { List, useTable, EditButton, DeleteButton } from "@refinedev/antd";
import { App, Select, Space, Switch, Table, Tag, Typography } from "antd";
import type { HttpError } from "@refinedev/core";
import dayjs from "dayjs";
import { isAxiosError } from "axios";
import { GLOSSARY_LANGUAGES, type GlossaryLanguage } from "@martly/shared/constants";
import type { ListGlossaryTerm } from "@martly/shared/types";
import { axiosInstance } from "../../providers/data-provider";
import { DebouncedSearch } from "../../components/DebouncedSearch";
import { languageOptions } from "./fields";

const LANGUAGE_COLORS: Record<GlossaryLanguage, string> = {
  ta: "geekblue",
  kn: "orange",
  ml: "green",
  te: "purple",
  hi: "magenta",
};

const PhraseTags = ({ phrases }: { phrases: ListGlossaryTerm["phrases"] }) => (
  <Space size={[4, 4]} wrap>
    {phrases.map((p) => (
      <Tag key={p.id} color={LANGUAGE_COLORS[p.language as GlossaryLanguage]} style={{ margin: 0 }}>
        {p.language.toUpperCase()} · {p.text}
      </Tag>
    ))}
  </Space>
);

export const GlossaryList = () => {
  const { tableProps, tableQueryResult, setFilters } = useTable<ListGlossaryTerm, HttpError>({
    resource: "list-glossary",
    pagination: { pageSize: 25 },
  });
  const { message } = App.useApp();
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const toggleActive = async (term: ListGlossaryTerm, isActive: boolean) => {
    setTogglingId(term.id);
    try {
      await axiosInstance.patch(`/list-glossary/${term.id}`, { isActive });
      await tableQueryResult.refetch();
    } catch (err) {
      if (!isAxiosError(err)) throw err;
      message.error(err.response?.data?.message ?? "Could not update the term");
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <List>
      <Typography.Paragraph type="secondary">
        How shoppers say things in their language, and the word our catalog uses. The shopping-list AI reads these.
      </Typography.Paragraph>
      <Space wrap style={{ marginBottom: 16 }}>
        <DebouncedSearch
          placeholder="Search catalog word or phrase"
          onSearch={(value) => setFilters([{ field: "q", operator: "eq", value: value || undefined }], "merge")}
          style={{ width: 320 }}
        />
        <Select
          defaultValue=""
          style={{ width: 160 }}
          options={[{ value: "", label: "All languages" }, ...languageOptions]}
          onChange={(value: string) =>
            setFilters([{ field: "language", operator: "eq", value: value || undefined }], "merge")
          }
        />
      </Space>
      <Table {...tableProps} rowKey="id">
        <Table.Column
          dataIndex="searchTerm"
          title="Catalog word"
          render={(v: string) => <Typography.Text strong>{v}</Typography.Text>}
        />
        <Table.Column
          title="Phrases"
          render={(_: unknown, r: ListGlossaryTerm) => <PhraseTags phrases={r.phrases} />}
        />
        <Table.Column
          dataIndex="note"
          title="Note"
          render={(v: string | null) => <Typography.Text type="secondary">{v}</Typography.Text>}
        />
        <Table.Column
          dataIndex="isActive"
          title="Active"
          render={(v: boolean, r: ListGlossaryTerm) => (
            <Switch checked={v} loading={togglingId === r.id} onChange={(checked) => toggleActive(r, checked)} />
          )}
        />
        <Table.Column
          dataIndex="updatedAt"
          title="Updated"
          render={(v: string) => dayjs(v).format("D MMM YYYY")}
        />
        <Table.Column
          title="Actions"
          render={(_: unknown, r: ListGlossaryTerm) => (
            <Space>
              <EditButton hideText size="small" recordItemId={r.id} />
              <DeleteButton hideText size="small" recordItemId={r.id} />
            </Space>
          )}
        />
      </Table>
    </List>
  );
};
