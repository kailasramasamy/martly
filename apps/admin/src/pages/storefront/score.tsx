import { Progress, Space, Typography } from "antd";
import { STOREFRONT_GROUPS, STOREFRONT_GROUP_LABELS, type StorefrontGroup } from "@martly/shared/constants";

export const scoreColor = (score: number) => (score < 40 ? "#ef4444" : score < 70 ? "#f59e0b" : "#16a34a");

/** One mini bar per group, labelled; a group with nothing that applies shows a dash */
export function GroupBars({ groups, width = 140 }: { groups: Record<StorefrontGroup, number | null>; width?: number }) {
  return (
    <Space direction="vertical" size={2}>
      {STOREFRONT_GROUPS.map((g) => (
        <div key={g} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Typography.Text type="secondary" style={{ width: 110, fontSize: 12 }}>{STOREFRONT_GROUP_LABELS[g].en}</Typography.Text>
          {groups[g] == null ? (
            <Typography.Text type="secondary">—</Typography.Text>
          ) : (
            <Progress percent={groups[g]} size="small" strokeColor={scoreColor(groups[g])} style={{ width }} format={(p) => `${p}`} />
          )}
        </div>
      ))}
    </Space>
  );
}
