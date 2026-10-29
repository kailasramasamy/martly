import { useCallback, useEffect, useMemo, useState } from "react";
import { App, Avatar, Button, Input, Segmented, Space, Table, Tag, Typography } from "antd";
import { CrownOutlined, SearchOutlined, ShopOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { axiosInstance } from "../../providers/data-provider";
import { sectionTitle } from "../../theme";
import { OrgPlanModal } from "./org-plan-modal";
import type { Subscriber } from "./types";
import { errorMessage } from "./utils";

const PAGE_SIZE = 25;
type Filter = "ALL" | "FREE" | "GROWTH" | "PRO" | "BETA";

const date = (v: string | null) => (v ? dayjs(v).format("D MMM YYYY") : "—");
const isBeta = (r: Subscriber) => r.webStoreAlwaysOn || r.unlimitedListings;

function matches(r: Subscriber, filter: Filter, query: string) {
  const inFilter = filter === "ALL" || (filter === "BETA" ? isBeta(r) : (r.plan?.code ?? "FREE") === filter);
  const q = query.trim().toLowerCase();
  const text = [r.name, r.town?.name, r.town?.state].filter(Boolean).join(" ").toLowerCase();
  return inFilter && (!q || text.includes(q));
}

function useSubscribers() {
  const { notification } = App.useApp();
  const [rows, setRows] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => {
    axiosInstance.get("/marketing-admin/subscribers")
      .then((res) => setRows(res.data.data))
      .catch((err) => notification.error({ message: errorMessage(err, "Could not load store plans") }))
      .finally(() => setLoading(false));
  }, [notification]);
  useEffect(load, [load]);
  return { rows, loading, load };
}

const columns = (onOpen: (r: Subscriber) => void) => [
  {
    title: "Store",
    render: (_: unknown, r: Subscriber) => (
      <Space>
        <Avatar shape="square" size={40} src={r.logoUrl ?? undefined} icon={<ShopOutlined />} style={{ background: r.logoUrl ? "#fff" : undefined }} />
        <div>
          <div style={{ fontWeight: 600 }}>{r.name}</div>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {[r.town ? `${r.town.name}, ${r.town.state}` : null, `${r.liveStores} of ${r.stores} store${r.stores === 1 ? "" : "s"} live`].filter(Boolean).join(" · ")}
          </Typography.Text>
        </div>
      </Space>
    ),
  },
  { title: "Plan", dataIndex: "plan", render: (p: Subscriber["plan"]) => (p ? <Tag color="teal">{p.name}</Tag> : <Tag>Free</Tag>) },
  {
    title: "Beta settings",
    render: (_: unknown, r: Subscriber) => (
      <Space size={4} wrap>
        {r.webStoreAlwaysOn && <Tag color="blue">Web store always on</Tag>}
        {r.unlimitedListings && <Tag color="purple">Unlimited products</Tag>}
      </Space>
    ),
  },
  { title: "Current period ends", dataIndex: "currentUntil", render: date },
  { title: "Paid through", dataIndex: "paidThrough", render: date },
  { title: "", render: (_: unknown, r: Subscriber) => <Button size="small" onClick={() => onOpen(r)}>Settings</Button> },
];

/** Every organisation's plan, with Martly's overrides (beta settings, given plans) */
export function StorePlans() {
  const { rows, loading, load } = useSubscribers();
  const [selected, setSelected] = useState<Subscriber | null>(null);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [query, setQuery] = useState("");
  const shown = useMemo(() => rows.filter((r) => matches(r, filter, query)), [rows, filter, query]);
  const count = (f: Filter) => rows.filter((r) => matches(r, f, "")).length;
  const options = (["ALL", "FREE", "GROWTH", "PRO", "BETA"] as const).map((f) => ({
    value: f,
    label: `${{ ALL: "All", FREE: "Free", GROWTH: "Growth", PRO: "Pro", BETA: "Beta settings" }[f]} (${count(f)})`,
  }));

  return (
    <>
      <h2 style={{ marginTop: 0 }}>{sectionTitle(<CrownOutlined />, "Store plans")}</h2>
      <Space wrap style={{ marginBottom: 16 }}>
        <Input allowClear prefix={<SearchOutlined />} placeholder="Search store, town or state" value={query} onChange={(e) => setQuery(e.target.value)} style={{ width: 280 }} />
        <Segmented options={options} value={filter} onChange={(v) => setFilter(v as Filter)} />
      </Space>
      <Table size="middle" rowKey="id" loading={loading} dataSource={shown} columns={columns(setSelected)} pagination={{ pageSize: PAGE_SIZE }} />
      <OrgPlanModal org={selected} onClose={() => setSelected(null)} onChanged={load} />
    </>
  );
}
