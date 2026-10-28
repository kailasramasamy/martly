import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button, Table, theme } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { PriceReviewItem } from "@martly/shared/types";
import { useApiList, itemParams, type ItemFilters, type PriceReviewActions } from "./api";
import { effectiveMrp, effectivePrice, isDirty, toDecision, useRowEdits } from "./edits";
import { ActionsCell, MrpCell, OffCell, PriceCell, ProductCell, StatusTag, isSuspicious } from "./item-cells";
import { SelectionBar } from "./selection-bar";

interface Props {
  storeId: string | undefined;
  filters: ItemFilters;
  version: number;
  actions: PriceReviewActions;
  canHide: boolean;
  emptyText: ReactNode;
}

/** The editable listing table: type a price, Enter saves it and drops to the next row */
export const ItemsTable = ({ storeId, filters, version, actions, canHide, emptyText }: Props) => {
  const { token } = theme.useToken();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const { edits, patch, revert, clear } = useRowEdits();
  const inputs = useRef(new Map<string, { focus: () => void } | null>());
  const focusNext = useRef<string | undefined>(undefined);
  const { rows, meta, loading } = useApiList<PriceReviewItem>("items", storeId ? itemParams(storeId, filters, page) : null, version);

  const filterKey = JSON.stringify(filters);
  useEffect(() => {
    setPage(1);
    setSelected([]);
  }, [storeId, filterKey]);

  useEffect(() => {
    if (focusNext.current) inputs.current.get(focusNext.current)?.focus();
    focusNext.current = undefined;
  }, [rows]);

  const dirtyRows = rows.filter((r) => isDirty(r, edits.get(r.id)));

  const save = async (item: PriceReviewItem) => {
    const dirty = isDirty(item, edits.get(item.id));
    const next = rows[rows.indexOf(item) + 1];
    if (!(await actions.decide([toDecision(item, edits.get(item.id))], !dirty))) return;
    revert(item.id);
    focusNext.current = next?.id;
  };

  const saveAll = async () => {
    if (await actions.decide(dirtyRows.map((r) => toDecision(r, edits.get(r.id))), false)) clear();
  };

  const bulk = async (body: Parameters<PriceReviewActions["bulk"]>[0]) => {
    if (await actions.bulk(body)) setSelected([]);
  };

  const columns: ColumnsType<PriceReviewItem> = [
    { title: "Product", render: (_, r) => <ProductCell item={r} /> },
    { title: "MRP", width: 150, render: (_, r) => <MrpCell item={r} edit={edits.get(r.id)} onChange={(c) => patch(r.id, c)} /> },
    {
      title: "Price",
      width: 140,
      render: (_, r) => (
        <PriceCell
          item={r}
          edit={edits.get(r.id)}
          onChange={(c) => patch(r.id, c)}
          inputRef={(el) => inputs.current.set(r.id, el)}
          onEnter={() => save(r)}
          onEscape={() => revert(r.id)}
        />
      ),
    },
    { title: "% off", width: 100, render: (_, r) => <OffCell item={r} edit={edits.get(r.id)} /> },
    { title: "Stock", dataIndex: "stock", width: 80, align: "right" },
    { title: "Status", width: 100, render: (_, r) => <StatusTag item={r} /> },
    {
      title: "Actions",
      width: 220,
      render: (_, r) => (
        <ActionsCell
          item={r}
          edit={edits.get(r.id)}
          canHide={canHide}
          onSave={() => save(r)}
          onHide={() => actions.decide([{ id: r.id, hide: true }], true)}
          onReopen={() => actions.reopen({ storeProductIds: [r.id] })}
        />
      ),
    },
  ];

  const rowBackground = (r: PriceReviewItem) => {
    const edit = edits.get(r.id);
    if (isDirty(r, edit)) return token.colorPrimaryBg;
    return isSuspicious(effectivePrice(r, edit), effectiveMrp(r, edit)) ? token.colorWarningBg : undefined;
  };

  return (
    <>
      {dirtyRows.length > 0 && (
        <Button type="primary" onClick={saveAll} style={{ marginBottom: 12 }}>Save all edits ({dirtyRows.length})</Button>
      )}
      <Table<PriceReviewItem>
        rowKey="id"
        size="small"
        columns={columns}
        dataSource={rows}
        loading={loading}
        locale={{ emptyText: storeId ? emptyText : "Pick a store to review its prices" }}
        onRow={(r) => ({ style: { background: rowBackground(r) } })}
        rowSelection={{ selectedRowKeys: selected, onChange: (keys) => setSelected(keys as string[]) }}
        pagination={{ current: page, pageSize: 50, total: meta?.total ?? 0, showSizeChanger: false, onChange: setPage }}
      />
      {selected.length > 0 && (
        <SelectionBar
          count={selected.length}
          canHide={canHide}
          onConfirm={() => bulk({ action: "confirm", scope: { storeProductIds: selected } })}
          onPercent={(percent) => bulk({ action: "percentOffMrp", percent, scope: { storeProductIds: selected } })}
          onHide={() => bulk({ action: "hide", scope: { storeProductIds: selected } })}
          onReopen={async () => {
            await actions.reopen({ storeProductIds: selected });
            setSelected([]);
          }}
          onClear={() => setSelected([])}
        />
      )}
    </>
  );
};
