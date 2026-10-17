import { useState } from "react";
import { Button, Card, Image, Popconfirm, Space, Switch, Table, Tag, Typography } from "antd";
import { DeleteOutlined, EditOutlined, PictureOutlined, PlusOutlined } from "@ant-design/icons";
import type { PromoBanner, PromoDetail } from "@martly/shared/types";
import { BANNER_PLACEMENT_CONFIG } from "../../constants/tag-colors";
import { sectionTitle } from "../../theme";
import { axiosInstance } from "../../providers/data-provider";
import { BannerSlotsNote, useBannerEntitlements, useNotifyBannerError } from "../banners/banner-shared";
import { useCategoryTree } from "../banners/category-target";
import { PromoBannerModal } from "./banner-modal";

const THUMB_WIDTH = 72;
const MAX_BANNERS = 6;

type Editing = PromoBanner | "new" | null;

function PlacementTag({ placement }: { placement: string }) {
  const config = BANNER_PLACEMENT_CONFIG[placement];
  return <Tag color={config?.color}>{config?.label ?? placement}</Tag>;
}

/** The banners a promotion runs, with their results; changes take effect straight away */
export function PromoBanners({ promo, onChanged }: { promo: PromoDetail; onChanged: () => void }) {
  const [editing, setEditing] = useState<Editing>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const tree = useCategoryTree();
  const { isOrgUser, entitlements } = useBannerEntitlements();
  const notifyError = useNotifyBannerError("Could not update the banner");
  const live = promo.status === "LIVE";

  const change = async (id: string, call: () => Promise<unknown>) => {
    setBusyId(id);
    try {
      await call();
      onChanged();
    } catch (err) {
      notifyError(err);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card
      title={sectionTitle(<PictureOutlined />, `Banners (${promo.banners.length})`)}
      size="small"
      style={{ marginBottom: 16 }}
      extra={<Button icon={<PlusOutlined />} disabled={promo.banners.length >= MAX_BANNERS} onClick={() => setEditing("new")}>Add banner</Button>}
    >
      {isOrgUser && <Typography.Paragraph><BannerSlotsNote slots={entitlements?.bannerSlots} /></Typography.Paragraph>}
      <Table<PromoBanner> dataSource={promo.banners} rowKey="id" pagination={false} size="small">
        <Table.Column<PromoBanner> title="" dataIndex="imageUrl" width={THUMB_WIDTH + 16} render={(url: string) => <Image src={url} width={THUMB_WIDTH} style={{ aspectRatio: "3 / 2", objectFit: "cover", borderRadius: 6 }} />} />
        <Table.Column<PromoBanner> title="Placement" dataIndex="placement" render={(p: string) => <PlacementTag placement={p} />} />
        <Table.Column<PromoBanner> title="Title" dataIndex="title" />
        <Table.Column<PromoBanner> title="Views" dataIndex="views" />
        <Table.Column<PromoBanner> title="Taps" dataIndex="taps" />
        <Table.Column<PromoBanner> title="Tap rate" dataIndex="ctr" render={(v: number) => `${v}%`} />
        <Table.Column<PromoBanner>
          title="Active"
          render={(_, b) => (
            <Switch size="small" checked={b.isActive} disabled={!live} loading={busyId === b.id} onChange={(isActive) => change(b.id, () => axiosInstance.put(`/promos/${promo.id}/banners/${b.id}`, { isActive }))} />
          )}
        />
        <Table.Column<PromoBanner>
          title=""
          width={96}
          render={(_, b) => (
            <Space>
              <Button type="text" icon={<EditOutlined />} onClick={() => setEditing(b)} aria-label="Edit banner" />
              <Popconfirm title="Remove this banner?" okText="Remove" okButtonProps={{ danger: true }} onConfirm={() => change(b.id, () => axiosInstance.delete(`/promos/${promo.id}/banners/${b.id}`))}>
                <Button type="text" danger icon={<DeleteOutlined />} loading={busyId === b.id} aria-label="Remove banner" />
              </Popconfirm>
            </Space>
          )}
        />
      </Table>
      {editing && (
        <PromoBannerModal
          promo={promo}
          banner={editing === "new" ? undefined : editing}
          tree={tree}
          aiImages={isOrgUser ? entitlements?.aiImages : undefined}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); onChanged(); }}
        />
      )}
    </Card>
  );
}
