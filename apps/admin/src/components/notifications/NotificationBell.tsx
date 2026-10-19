import { useState } from "react";
import { useNavigate } from "react-router";
import { Badge, Button, Empty, List, Popover, Spin, Typography, theme } from "antd";
import {
  BellOutlined,
  ShoppingCartOutlined,
  InboxOutlined,
  CarOutlined,
  CustomerServiceOutlined,
  NotificationOutlined,
  TeamOutlined,
  BellFilled,
} from "@ant-design/icons";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { useNotifications } from "../../hooks/useNotifications";
import { notificationRoute, type StaffNotification } from "./helpers";

dayjs.extend(relativeTime);

const { Text } = Typography;

const TYPE_ICONS: Record<string, React.ReactNode> = {
  NEW_ORDER: <ShoppingCartOutlined />,
  STAFF_ORDER: <ShoppingCartOutlined />,
  STAFF_STOCK: <InboxOutlined />,
  STAFF_DELIVERY: <CarOutlined />,
  STAFF_SERVICE: <CustomerServiceOutlined />,
  STAFF_MARKETING: <NotificationOutlined />,
  STAFF_TEAM: <TeamOutlined />,
};

const BRAND = "#0d9488";

export function NotificationBell() {
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const [open, setOpen] = useState(false);

  const { items, unread, loading, reload, openNotification, markAllRead } = useNotifications((n) => {
    const route = notificationRoute(n.data);
    if (route) navigate(route);
    setOpen(false);
  });

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) void reload();
  };

  const content = (
    <div style={{ width: 380 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 8 }}>
        <Text strong>Notifications</Text>
        <Button type="link" size="small" disabled={unread === 0} onClick={() => void markAllRead()} style={{ color: unread ? BRAND : undefined }}>
          Mark all read
        </Button>
      </div>
      <Spin spinning={loading}>
        {items.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No notifications" />
        ) : (
          <List
            style={{ maxHeight: 420, overflowY: "auto" }}
            dataSource={items}
            renderItem={(n) => (
              <List.Item
                onClick={() => openNotification(n)}
                style={{ cursor: "pointer", padding: "10px 8px", background: n.isRead ? undefined : token.colorFillTertiary, borderRadius: 6 }}
              >
                <List.Item.Meta
                  avatar={<span style={{ color: BRAND, fontSize: 18 }}>{TYPE_ICONS[n.type] ?? <BellFilled />}</span>}
                  title={
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <Text strong={!n.isRead} ellipsis>{n.title}</Text>
                      {!n.isRead && <Badge color={BRAND} />}
                    </div>
                  }
                  description={
                    <>
                      <div style={{ color: token.colorTextSecondary }}>{n.body}</div>
                      <Text type="secondary" style={{ fontSize: 12 }}>{dayjs(n.createdAt).fromNow()}</Text>
                    </>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Spin>
    </div>
  );

  return (
    <Popover content={content} trigger="click" placement="bottomRight" open={open} onOpenChange={handleOpenChange} arrow={false}>
      <Badge count={unread} size="small" overflowCount={99} offset={[-4, 4]}>
        <Button type="text" size="small" icon={<BellOutlined />} title="Notifications" style={{ color: "rgba(255,255,255,0.85)" }} />
      </Badge>
    </Popover>
  );
}
