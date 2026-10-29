import { useCallback, useEffect, useState } from "react";
import { useSelect } from "@refinedev/antd";
import { useCan } from "@refinedev/core";
import { App, Button, Card, Empty, Popconfirm, Select, Space, Spin, Tag, Typography, theme } from "antd";
import { DeleteOutlined, EditOutlined, MessageOutlined, PlusOutlined } from "@ant-design/icons";
import { isAxiosError } from "axios";
import { ReadableSection } from "../../components/ReadableSection";
import { sectionTitle } from "../../theme";
import { errorMessage, kindOf, storeVoice, type EditablePost, type PostProduct, type StorePostRow } from "./api";
import { PostDrawer } from "./PostDrawer";

const { Text, Paragraph } = Typography;

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

// The store's posts from the last 30 days, reloaded after any change
function usePosts(storeId: string | undefined) {
  const [posts, setPosts] = useState<StorePostRow[] | null>(null);
  const load = useCallback(async () => {
    if (!storeId) return setPosts(null);
    setPosts(null);
    try {
      setPosts(await storeVoice.posts(storeId));
    } catch (err) {
      if (!isAxiosError(err)) throw err;
      setPosts([]);
    }
  }, [storeId]);
  useEffect(() => { void load(); }, [load]);
  return { posts, load };
}

// Opening a post in the drawer (new or loaded for editing) and deleting one
function usePostActions(reload: () => Promise<void>) {
  const { message } = App.useApp();
  const [drawer, setDrawer] = useState<{ editing: EditablePost | null } | null>(null);
  const run = async (request: () => Promise<void>, failed: string) => {
    try {
      await request();
    } catch (err) {
      if (!isAxiosError(err)) throw err;
      message.error(errorMessage(err, failed));
    }
  };
  const edit = (id: string) => run(async () => setDrawer({ editing: await storeVoice.post(id) }), "Couldn't open the post");
  const remove = (id: string) => run(async () => {
    await storeVoice.remove(id);
    message.success("Post deleted");
    await reload();
  }, "Couldn't delete the post");
  return { drawer, setDrawer, edit, remove };
}

// Each tagged product as shoppers see it: photo, name, size and today's price
function ProductTile({ sp }: { sp: PostProduct }) {
  const { token } = theme.useToken();
  const image = sp.product.imageUrl ?? sp.variant.imageUrl;
  const { effectivePrice, originalPrice } = sp.pricing;
  return (
    <div style={{ border: `1px solid ${token.colorBorderSecondary}`, borderRadius: 10, padding: 8 }}>
      {/* Multiply blends white pack-shot backdrops into the grey well */}
      <div style={{ height: 88, borderRadius: 8, background: "#f3f5f8", padding: 6, marginBottom: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {image && <img src={image} alt={sp.product.name} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", mixBlendMode: "multiply" }} />}
      </div>
      <Paragraph strong ellipsis={{ rows: 2, tooltip: sp.product.name }} style={{ fontSize: 13, lineHeight: "18px", minHeight: 36, marginBottom: 2 }}>{sp.product.name}</Paragraph>
      <Text type="secondary" style={{ fontSize: 12 }}>{sp.variant.name}</Text>
      <div>
        <Text strong>{`\u20B9${Math.round(effectivePrice)}`}</Text>
        {originalPrice > effectivePrice && <Text delete type="secondary" style={{ fontSize: 12, marginLeft: 6 }}>{`\u20B9${Math.round(originalPrice)}`}</Text>}
      </div>
    </div>
  );
}

function PostCard({ post, canEdit, onEdit, onDelete }: { post: StorePostRow; canEdit: boolean; onEdit: () => void; onDelete: () => void }) {
  const live = new Date(post.expiresAt) > new Date();
  const kind = kindOf(post.kind);
  const actions = canEdit ? [
    <Button key="edit" type="text" icon={<EditOutlined />} onClick={onEdit}>Edit</Button>,
    <Popconfirm key="delete" title="Delete this post?" description="Shoppers stop seeing it on Home and the shop's board." okText="Delete" okButtonProps={{ danger: true }} onConfirm={onDelete}>
      <Button type="text" danger icon={<DeleteOutlined />}>Delete</Button>
    </Popconfirm>,
  ] : undefined;
  return (
    <Card size="small" actions={actions}>
      <Space style={{ width: "100%", justifyContent: "space-between", marginBottom: 8 }}>
        <Tag color={kind.color}>{kind.label.toUpperCase()}</Tag>
        <Tag color={live ? "success" : "default"}>{live ? `Live till ${when(post.expiresAt)}` : "Ended"}</Tag>
      </Space>
      <Paragraph strong style={{ fontSize: 15, marginBottom: 6 }}>{post.text}</Paragraph>
      {Object.values(post.translations ?? {}).map((tr) => tr && <Paragraph key={tr.text} type="secondary" style={{ marginBottom: 6 }}>{tr.text}</Paragraph>)}
      <Text type="secondary" style={{ fontSize: 12 }}>
        {`Posted ${when(post.createdAt)}${post.products.length ? "" : " · No tagged products in stock"}`}
      </Text>
      {post.products.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8, marginTop: 10 }}>
          {post.products.map((sp) => <ProductTile key={sp.id} sp={sp} />)}
        </div>
      )}
    </Card>
  );
}

/** Shop posts: the owner's "fresh today / new in store / back in stock" notes to shoppers, per store */
export const StorePostsPage = () => {
  const { data: access } = useCan({ resource: "store-posts", action: "edit" });
  const { selectProps, query } = useSelect({ resource: "stores", optionLabel: "name", optionValue: "id", pagination: { pageSize: 100 } });
  const [storeId, setStoreId] = useState<string>();
  const firstStore = query.data?.data[0]?.id as string | undefined;
  const store = storeId ?? firstStore;
  const { posts, load } = usePosts(store);
  const { drawer, setDrawer, edit, remove } = usePostActions(load);
  const canEdit = !!access?.can;

  return (
    <ReadableSection>
      <Card
        title={sectionTitle(<MessageOutlined />, "Shop posts")}
        extra={(
          <Space>
            <Select options={selectProps.options} loading={selectProps.loading} value={store} onChange={setStoreId} style={{ width: 240 }} placeholder="Store" />
            {canEdit && store && <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawer({ editing: null })}>New post</Button>}
          </Space>
        )}
      >
        <Paragraph type="secondary">What came in today, what's new, what's back. Shoppers see live posts on Home and the shop's board, in their language.</Paragraph>
        {posts === null ? <Spin /> : posts.length === 0 ? <Empty description="No posts in the last 30 days" /> : (
          <Space direction="vertical" size={12} style={{ width: "100%" }}>
            {posts.map((p) => <PostCard key={p.id} post={p} canEdit={canEdit} onEdit={() => void edit(p.id)} onDelete={() => void remove(p.id)} />)}
          </Space>
        )}
      </Card>
      {drawer && store && (
        <PostDrawer open storeId={store} editing={drawer.editing} onClose={(saved) => { setDrawer(null); if (saved) void load(); }} />
      )}
    </ReadableSection>
  );
};
