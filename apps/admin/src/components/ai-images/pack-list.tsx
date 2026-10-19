import { Button, List, Space, Tooltip, Typography } from "antd";
import { formatRupees } from "../../pages/promos/promo-utils";
import type { AdProduct } from "../../pages/marketing/types";

const OWNER_ONLY = "Only the owner can buy";

interface PackListProps {
  packs: AdProduct[];
  canBuy: boolean;
  buying: string | null;
  buy: (pack: AdProduct) => void;
}

/** AI image packs with their price, per-image price and a Buy button; packs never expire */
export function PackList({ packs, canBuy, buying, buy }: PackListProps) {
  return (
    <List
      dataSource={packs}
      renderItem={(pack) => (
        <List.Item
          actions={[
            <Tooltip key="buy" title={canBuy ? undefined : OWNER_ONLY}>
              <Button type="primary" disabled={!canBuy} loading={buying === pack.id} onClick={() => buy(pack)}>Buy</Button>
            </Tooltip>,
          ]}
        >
          <List.Item.Meta
            title={<Space>{pack.name}<Typography.Text type="secondary">{pack.aiImageCredits} AI images</Typography.Text></Space>}
            description={`${formatRupees(pack.price)} +${pack.gstPercent}% GST · ${formatRupees(pack.price / pack.aiImageCredits)} per image · never expire`}
          />
        </List.Item>
      )}
    />
  );
}
