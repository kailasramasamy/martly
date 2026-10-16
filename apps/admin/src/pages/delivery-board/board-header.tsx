import { Button, DatePicker, Select, Space, theme } from "antd";
import { LeftOutlined, ReloadOutlined, RightOutlined, ShopOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

interface BoardHeaderProps {
  stores: { id: string; name: string }[];
  storeId: string | null;
  date: dayjs.Dayjs;
  loading: boolean;
  onStore: (id: string) => void;
  onDate: (d: dayjs.Dayjs) => void;
  onReload: () => void;
}

export function BoardHeader({ stores, storeId, date, loading, onStore, onDate, onReload }: BoardHeaderProps) {
  const { token } = theme.useToken();
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: token.colorText }}>Delivery Board</h2>
      <Space size={8} wrap>
        <Select value={storeId} onChange={onStore} style={{ minWidth: 200 }} suffixIcon={<ShopOutlined />} options={stores.map((s) => ({ label: s.name, value: s.id }))} />
        <Button icon={<LeftOutlined />} onClick={() => onDate(date.subtract(1, "day"))} />
        <DatePicker value={date} onChange={(d) => d && onDate(d)} allowClear={false} format="ddd, DD MMM" style={{ width: 150 }} />
        <Button icon={<RightOutlined />} onClick={() => onDate(date.add(1, "day"))} />
        {!date.isSame(dayjs(), "day") && <Button onClick={() => onDate(dayjs())}>Today</Button>}
        <Button icon={<ReloadOutlined />} onClick={onReload} loading={loading} />
      </Space>
    </div>
  );
}
