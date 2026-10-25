import { useCallback, useEffect, useState } from "react";
import { useSelect } from "@refinedev/antd";
import { useCan } from "@refinedev/core";
import { App, Avatar, Button, Card, Input, List, Select, Space, Switch, Tag, Typography } from "antd";
import { LikeOutlined } from "@ant-design/icons";
import { isAxiosError } from "axios";
import { axiosInstance } from "../../providers/data-provider";
import { sectionTitle } from "../../theme";
import { errorMessage } from "../store-posts/api";

const { Text } = Typography;
const STARTERS = ["We use it at home", "Best value here", "Fresh every week", "Customers come back for it"];

interface AislePicks {
  aisle: string | null;
  limit: number;
  picks: { id: string; productId: string; note: string; product: { name: string; imageUrl: string | null } }[];
}

// The aisle's picks at a store, and saving or removing one
function usePicks(storeId: string | undefined, productId: string) {
  const { message } = App.useApp();
  const [data, setData] = useState<AislePicks | null>(null);
  const load = useCallback(async () => {
    if (!storeId) return;
    try {
      const res = await axiosInstance.get<{ data: AislePicks }>("/store-voice/picks", { params: { storeId, productId } });
      setData(res.data.data);
    } catch (err) {
      if (!isAxiosError(err)) throw err;
      setData(null);
    }
  }, [storeId, productId]);
  useEffect(() => { void load(); }, [load]);
  const act = async (request: () => Promise<unknown>, done: string) => {
    try {
      await request();
      message.success(done);
      await load();
    } catch (err) {
      if (!isAxiosError(err)) throw err;
      message.error(errorMessage(err, "Couldn't save the pick"));
    }
  };
  const save = (note: string) => act(() => axiosInstance.put("/store-voice/picks", { storeId, productId, note }), "Saved as your pick");
  const remove = (id: string) => act(() => axiosInstance.delete("/store-voice/picks", { params: { storeId, productId: id } }), "Pick removed");
  return { data, save, remove };
}

function PickEditor({ storeId, productId }: { storeId: string; productId: string }) {
  const { data, save, remove } = usePicks(storeId, productId);
  const mine = data?.picks.find((p) => p.productId === productId);
  const [on, setOn] = useState(false);
  const [note, setNote] = useState("");
  useEffect(() => { setOn(!!mine); setNote(mine?.note ?? ""); }, [mine?.id, mine?.note]);
  const full = !!data && !mine && data.picks.length >= data.limit;
  const toggle = (value: boolean) => (value ? setOn(true) : mine ? void remove(productId) : setOn(false));
  return (
    <Space direction="vertical" size={12} style={{ width: "100%" }}>
      <Space align="start">
        <Switch checked={on} onChange={toggle} disabled={full} />
        <div>
          <Text strong>I recommend this</Text><br />
          <Text type="secondary">{full ? `${data!.limit} picks in this aisle already. Remove one to pick this.` : "Shows \"Owner's pick\" on the product, in its aisle and in search"}</Text>
        </div>
      </Space>
      {on && (
        <>
          <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={90} showCount placeholder="Why, in a line: We cook with this at home" />
          <Space wrap>{STARTERS.map((s) => <Tag.CheckableTag key={s} checked={note === s} onChange={() => setNote(s)}>{s}</Tag.CheckableTag>)}</Space>
          <Button type="primary" disabled={!note.trim() || note.trim() === mine?.note} onClick={() => void save(note.trim())}>Save pick</Button>
        </>
      )}
      {data && data.picks.length > 0 && (
        <List
          size="small" header={<Text type="secondary">{`Your picks in ${data.aisle ?? "this aisle"} · ${data.picks.length} of ${data.limit}`}</Text>}
          dataSource={data.picks}
          renderItem={(p) => (
            <List.Item actions={p.productId === productId ? [<Tag key="this" color="cyan">This one</Tag>] : [<Button key="rm" size="small" onClick={() => void remove(p.productId)}>Remove</Button>]}>
              <List.Item.Meta avatar={<Avatar shape="square" src={p.product.imageUrl} />} title={p.product.name} description={`"${p.note}"`} />
            </List.Item>
          )}
        />
      )}
    </Space>
  );
}

/** "Owner's pick" for a product at one store: why the owner vouches for it, and the aisle's other picks (3 at most) */
export function OwnerPickCard({ productId }: { productId: string }) {
  const { data: access } = useCan({ resource: "store-posts", action: "edit" });
  const { selectProps, query } = useSelect({ resource: "stores", optionLabel: "name", optionValue: "id", pagination: { pageSize: 100 } });
  const [storeId, setStoreId] = useState<string>();
  const store = storeId ?? (query.data?.data[0]?.id as string | undefined);
  if (!access?.can) return null;
  return (
    <Card
      title={sectionTitle(<LikeOutlined />, "Owner's pick")} size="small" style={{ marginBottom: 16 }}
      extra={<Select options={selectProps.options} loading={selectProps.loading} value={store} onChange={setStoreId} style={{ width: 220 }} placeholder="Store" />}
    >
      {store && <PickEditor key={store} storeId={store} productId={productId} />}
    </Card>
  );
}
