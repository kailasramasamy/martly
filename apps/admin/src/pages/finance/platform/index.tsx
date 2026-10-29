import { Tabs } from "antd";
import { SwapOutlined } from "@ant-design/icons";
import { sectionTitle } from "../../../theme";
import { AccountsTab } from "./accounts-tab";
import { AdjustTab } from "./adjust-tab";
import { BalancesTab } from "./balances-tab";
import { DuesTab } from "./dues-tab";
import { QueueTab } from "./queue-tab";

export const PlatformPayoutsPage = () => (
  <>
    <h2 style={{ marginTop: 0 }}>{sectionTitle(<SwapOutlined />, "Platform payouts")}</h2>
    <Tabs
      destroyOnHidden
      items={[
        { key: "balances", label: "Balances", children: <BalancesTab /> },
        { key: "queue", label: "Payout queue", children: <QueueTab /> },
        { key: "accounts", label: "Accounts to verify", children: <AccountsTab /> },
        { key: "adjust", label: "Adjustment", children: <AdjustTab /> },
        { key: "dues", label: "Dues", children: <DuesTab /> },
      ]}
    />
  </>
);
