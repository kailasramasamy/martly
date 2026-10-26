import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Button, Card, Empty, Segmented, Table, Tag, Typography, App } from "antd";
import { PlusOutlined, RocketOutlined } from "@ant-design/icons";
import { STORE_SIZE_RULES } from "@martly/shared/constants";
import type { OnboardingSummary } from "@martly/shared/types";

import { sectionTitle } from "../../theme";
import { errorMessage, onboardingApi } from "./api";

const { Text } = Typography;

type View = "progress" | "launched";

const shortDate = (v: string) => new Date(v).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

/** Which step a store has reached, from what it already has */
function progress(o: OnboardingSummary) {
  if (o.status !== "PENDING") return { label: o.status === "ACTIVE" ? "Live" : o.status.toLowerCase(), color: o.status === "ACTIVE" ? "green" : "default" };
  if (o.storefrontCopied) return { label: "Ready to review", color: "lime" };
  if (o.listings > 0) return { label: "Catalog applied", color: "cyan" };
  if (o.size) return { label: "Choosing catalog", color: "blue" };
  return { label: "Details entered", color: "default" };
}

export const OnboardingList = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [rows, setRows] = useState<OnboardingSummary[]>();
  const [view, setView] = useState<View>("launched");
  const shown = useMemo(() => rows?.filter((r) => (r.status === "PENDING") === (view === "progress")), [rows, view]);
  const inProgress = rows?.filter((r) => r.status === "PENDING").length ?? 0;

  useEffect(() => {
    onboardingApi.list().then(setRows).catch((err) => message.error(errorMessage(err, "Couldn't load stores being set up")));
  }, [message]);

  return (
    <Card
      title={sectionTitle(<RocketOutlined />, "Onboard a store")}
      extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/onboarding/new")}>New store</Button>}
    >
      <Text type="secondary" style={{ display: "block", marginBottom: 16 }}>
        Stores stay hidden from shoppers until you launch them. Pick up where you left off at any time.
      </Text>
      <Segmented<View>
        value={view}
        onChange={setView}
        style={{ marginBottom: 16 }}
        options={[
          { value: "launched", label: `Launched${rows ? ` (${rows.length - inProgress})` : ""}` },
          { value: "progress", label: `In progress${rows ? ` (${inProgress})` : ""}` },
        ]}
      />
      <Table
        rowKey="storeId"
        loading={!rows}
        dataSource={shown}
        pagination={false}
        locale={{ emptyText: <Empty description={view === "progress" ? "No stores being set up" : "No stores launched from here yet"} /> }}
        onRow={(r) => ({ onClick: () => navigate(`/onboarding/${r.storeId}`), style: { cursor: "pointer" } })}
      >
        <Table.Column<OnboardingSummary> title="Store" render={(_, r) => <><Text strong>{r.storeName}</Text><br /><Text type="secondary">{r.organization.name}</Text></>} />
        <Table.Column<OnboardingSummary> title="Owner" render={(_, r) => r.owner ? <>{r.owner.name}<br /><Text type="secondary">{r.owner.phone}</Text></> : "—"} />
        <Table.Column<OnboardingSummary> title="Region" dataIndex="region" render={(v) => v ?? "National"} />
        <Table.Column<OnboardingSummary> title="Size" dataIndex="size" render={(v: OnboardingSummary["size"]) => (v ? STORE_SIZE_RULES[v].label : "—")} />
        <Table.Column<OnboardingSummary> title="Listings" dataIndex="listings" align="right" render={(v: number) => v.toLocaleString("en-IN")} />
        <Table.Column<OnboardingSummary> title="Progress" render={(_, r) => { const p = progress(r); return <Tag color={p.color}>{p.label}</Tag>; }} />
        <Table.Column<OnboardingSummary> title="Started" dataIndex="createdAt" render={shortDate} />
        {view === "launched" && <Table.Column<OnboardingSummary> title="Launched" dataIndex="launchedAt" render={(v: string | null) => (v ? shortDate(v) : "—")} />}
      </Table>
    </Card>
  );
};
