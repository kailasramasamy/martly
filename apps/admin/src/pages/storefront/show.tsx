import { useCallback, useEffect, useState } from "react";
import { Show } from "@refinedev/antd";
import { useParams } from "react-router";
import { Button, Card, Space, Statistic, Typography, message } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import type { StorefrontHealth } from "@martly/shared/types";

import { axiosInstance } from "../../providers/data-provider";
import { ReadableSection } from "../../components/ReadableSection";
import { GroupBars, scoreColor } from "./score";
import { ChecksCard, type DraftAction } from "./checks-card";
import { EffectivenessCard } from "./effectiveness-card";
import { AiDraftModal } from "./ai-draft-modal";

function Trend({ trend }: { trend: StorefrontHealth["trend"] }) {
  if (trend.length === 0) return <Typography.Text type="secondary">No history yet</Typography.Text>;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 48 }}>
      {trend.map((t) => (
        <div key={t.date} title={`${t.date}: ${t.score}`} style={{ width: 6, height: `${Math.max(t.score, 4)}%`, background: scoreColor(t.score), borderRadius: 2 }} />
      ))}
    </div>
  );
}

function HeaderCard({ health }: { health: StorefrontHealth }) {
  return (
    <Card size="small">
      <Space size={48} align="start" wrap>
        <Statistic title="Score" value={health.score} suffix="/ 100" valueStyle={{ fontSize: 48, color: scoreColor(health.score) }} />
        <GroupBars groups={health.groups} />
        <Space direction="vertical" size={4}>
          <Typography.Text type="secondary">Last {health.trend.length} days</Typography.Text>
          <Trend trend={health.trend} />
        </Space>
        <Space direction="vertical" size={4}>
          <Typography.Text type="secondary">Plan allowance left</Typography.Text>
          <Typography.Text>{health.allowance.promotions} promotions</Typography.Text>
          <Typography.Text>{health.allowance.aiImages} AI images</Typography.Text>
        </Space>
      </Space>
    </Card>
  );
}

/** One store's storefront health: score, what to do next, every check, and what is working */
export const StorefrontShow = () => {
  const { id: storeId = "" } = useParams();
  const [health, setHealth] = useState<StorefrontHealth | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [draftAction, setDraftAction] = useState<DraftAction | null>(null);

  const load = useCallback(async (fresh: boolean) => {
    setRefreshing(true);
    try {
      const res = await axiosInstance.get("/storefront/health", { params: { storeId, fresh } });
      setHealth(res.data.data);
    } catch (err: any) {
      message.error(err.response?.data?.message ?? "Couldn't load storefront health");
    } finally {
      setRefreshing(false);
    }
  }, [storeId]);

  useEffect(() => { load(false); }, [load]);

  return (
    <Show title="Storefront health" isLoading={!health} headerButtons={() => (
      <Button icon={<ReloadOutlined />} loading={refreshing} onClick={() => load(true)}>Refresh</Button>
    )}>
      {health && (
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <ReadableSection><HeaderCard health={health} /></ReadableSection>
          <ChecksCard storeId={storeId} health={health} onDraft={setDraftAction} />
          <EffectivenessCard storeId={storeId} />
        </Space>
      )}
      <AiDraftModal storeId={storeId} action={draftAction} onClose={() => setDraftAction(null)} onDone={() => load(true)} />
    </Show>
  );
};
