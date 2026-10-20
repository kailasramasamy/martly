import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { App, Empty, Table, Tag, Typography } from "antd";
import { BankOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { LedgerEntryTypeLabels, type LedgerEntryType } from "@martly/shared/constants";
import { axiosInstance } from "../../providers/data-provider";
import { sectionTitle } from "../../theme";
import { LedgerSummaryCards } from "./ledger-summary";
import { EMPTY_FILTERS, LedgerFilterBar, ledgerParams, type LedgerFilters } from "./ledger-filters";
import { SignedAmount, errorMessage, saveBlob, useFinanceOrg } from "./utils";
import type { LedgerEntry, LedgerSummary } from "./types";

const PAGE_SIZE = 30;

export function StateTag({ entry }: { entry: LedgerEntry }) {
  if (entry.state === "SETTLED") return <Tag color="green">Settled{entry.settlementNumber ? ` · ${entry.settlementNumber}` : ""}</Tag>;
  if (entry.state === "ON_HOLD") return <Tag color="gold">On hold{entry.availableAt ? ` · available from ${dayjs(entry.availableAt).format("D MMM")}` : ""}</Tag>;
  return <Tag color="blue">Available</Tag>;
}

const columns = [
  { title: "Date", dataIndex: "createdAt", width: 190, render: (v: string) => dayjs(v).format("D MMM YYYY, h:mm A") },
  { title: "Store", dataIndex: "storeName", render: (v: string | null) => v ?? "All stores" },
  { title: "Type", dataIndex: "type", render: (v: LedgerEntryType) => LedgerEntryTypeLabels[v] ?? v },
  { title: "Memo", dataIndex: "memo", render: (v: string | null) => v ?? "—" },
  { title: "Amount", dataIndex: "amount", align: "right" as const, render: (v: number) => <SignedAmount value={Number(v)} /> },
  { title: "State", render: (_: unknown, r: LedgerEntry) => <StateTag entry={r} /> },
  {
    title: "Order",
    render: (_: unknown, r: LedgerEntry) => (r.orderId ? <Link to={`/orders/show/${r.orderId}`}>{r.orderRef ?? r.orderId.slice(0, 8).toUpperCase()}</Link> : "—"),
  },
];

function useLedger(organizationId: string | undefined, enabled: boolean) {
  const { notification } = App.useApp();
  const [filters, setFilters] = useState<LedgerFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<LedgerEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<LedgerSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    axiosInstance.get("/ledger/summary", { params: { organizationId } })
      .then((res) => setSummary(res.data.data))
      .catch((err) => notification.error({ message: errorMessage(err, "Could not load the summary") }));
  }, [organizationId, enabled, notification]);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const res = await axiosInstance.get("/ledger", { params: { ...ledgerParams(filters, organizationId), page, pageSize: PAGE_SIZE } });
      setRows(res.data.data);
      setTotal(res.data.meta?.total ?? res.data.data.length);
    } catch (err) {
      notification.error({ message: errorMessage(err, "Could not load the ledger") });
    } finally {
      setLoading(false);
    }
  }, [enabled, filters, organizationId, page, notification]);

  useEffect(() => { void load(); }, [load]);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const res = await axiosInstance.get("/ledger/export.csv", { params: ledgerParams(filters, organizationId), responseType: "blob" });
      saveBlob(res.data, `ledger-${dayjs().format("YYYY-MM-DD")}.csv`);
    } catch (err) {
      notification.error({ message: errorMessage(err, "Could not export the ledger") });
    } finally {
      setExporting(false);
    }
  };

  const changeFilters = (next: LedgerFilters) => { setFilters(next); setPage(1); };
  return { filters, changeFilters, page, setPage, rows, total, summary, loading, exporting, exportCsv };
}

export const LedgerPage = () => {
  const { organizationId, picker, ready } = useFinanceOrg();
  const ledger = useLedger(organizationId, ready);
  const storeOptions = (ledger.summary?.stores ?? []).map((s) => ({ value: s.storeId, label: s.name }));

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>{sectionTitle(<BankOutlined />, "Ledger")}</h2>
        {picker}
      </div>
      {!ready ? (
        <Empty description={<Typography.Text type="secondary">Choose an organization to see its ledger</Typography.Text>} />
      ) : (
        <>
          {ledger.summary && <LedgerSummaryCards summary={ledger.summary} />}
          <LedgerFilterBar filters={ledger.filters} stores={storeOptions} exporting={ledger.exporting} onChange={ledger.changeFilters} onExport={ledger.exportCsv} />
          <Table
            size="small"
            rowKey="id"
            loading={ledger.loading}
            dataSource={ledger.rows}
            columns={columns}
            scroll={{ x: 1000 }}
            pagination={{ current: ledger.page, pageSize: PAGE_SIZE, total: ledger.total, showSizeChanger: false, onChange: ledger.setPage }}
          />
        </>
      )}
    </>
  );
};
