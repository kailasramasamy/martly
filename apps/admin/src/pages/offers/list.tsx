import { useState } from "react";
import { useGetIdentity, useInvalidate } from "@refinedev/core";
import { List, useTable } from "@refinedev/antd";
import { Table, Tag, Card, Row, Col, Button, Segmented, Space, Popconfirm, Avatar, message } from "antd";
import { PlusOutlined, EditOutlined, StopOutlined } from "@ant-design/icons";
import { Link, useNavigate } from "react-router";
import type { StoreOffer, StoreOfferStatus } from "@martly/shared/types";
import { can } from "@martly/shared/permissions";

import { axiosInstance } from "../../providers/data-provider";
import { StoreSelect } from "../../components/StoreSelect";
import { DebouncedSearch } from "../../components/DebouncedSearch";
import { OFFER_KIND_CONFIG, OFFER_TABS, inr, offerDates, offerText } from "./describe";

/** Buy X get Y, discounts and member prices running at a store; edit the listing or end the offer */
export const OfferList = () => {
  const navigate = useNavigate();
  const invalidate = useInvalidate();
  const { data: identity } = useGetIdentity<{ role: string; permissions?: string[] }>();
  const [storeId, setStoreId] = useState<string>();
  const [status, setStatus] = useState<StoreOfferStatus>("live");
  const [q, setQ] = useState("");
  const [ending, setEnding] = useState<string>();
  const { tableProps } = useTable<StoreOffer>({
    resource: "offers",
    pagination: { pageSize: 25 },
    filters: { permanent: [
      { field: "storeId", operator: "eq", value: storeId },
      { field: "status", operator: "eq", value: status },
      { field: "q", operator: "eq", value: q || undefined },
    ] },
    queryOptions: { enabled: !!storeId },
  });

  const end = async (o: StoreOffer) => {
    setEnding(o.id);
    try {
      await axiosInstance.post("/offers/end", { kind: o.kind, storeId, storeProductIds: [o.storeProductId] });
      message.success("Offer ended");
      invalidate({ resource: "offers", invalidates: ["list"] });
    } catch (err: any) {
      message.error(err.response?.data?.message ?? "Couldn't end the offer");
    } finally {
      setEnding(undefined);
    }
  };

  return (
    <List
      title="Offers"
      headerButtons={can(identity, "offers", "create") ? (
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate(`/offers/create${storeId ? `?storeId=${storeId}` : ""}`)}>
          New offer
        </Button>
      ) : null}
    >
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} md={8}><StoreSelect value={storeId} onChange={setStoreId} style={{ width: "100%" }} /></Col>
          <Col xs={24} md={7}><Segmented block options={OFFER_TABS} value={status} onChange={(v) => setStatus(v as StoreOfferStatus)} /></Col>
          <Col xs={24} md={9}><DebouncedSearch placeholder="Search products" onSearch={setQ} disabled={!storeId} /></Col>
        </Row>
      </Card>

      <Table
        {...tableProps}
        dataSource={storeId ? tableProps.dataSource : []}
        rowKey="id"
        size="small"
        locale={{ emptyText: storeId ? "No offers here. Use New offer to put one on products." : "Pick a store to see its offers" }}
      >
        <Table.Column<StoreOffer> title="Product" render={(_, o) => (
          <Space>
            <Avatar shape="square" src={o.imageUrl} />
            <span>{o.productName} · {o.variantName}</span>
          </Space>
        )} />
        <Table.Column<StoreOffer> dataIndex="kind" title="Kind" render={(k: StoreOffer["kind"]) => <Tag color={OFFER_KIND_CONFIG[k].color}>{OFFER_KIND_CONFIG[k].label}</Tag>} />
        <Table.Column<StoreOffer> title="Offer" render={(_, o) => offerText(o)} />
        <Table.Column<StoreOffer> dataIndex="price" title="Price" align="right" render={(v: number) => inr(v)} />
        <Table.Column<StoreOffer> title="When" render={(_, o) => offerDates(o)} />
        <Table.Column<StoreOffer> title="Actions" render={(_, o) => (
          <Space>
            <Link to={`/store-products/edit/${o.storeProductId}`}><Button size="small" icon={<EditOutlined />}>Edit listing</Button></Link>
            {status !== "ended" && (
              <Popconfirm title="End this offer?" description={`${offerText(o)} on ${o.productName} ${o.variantName} stops now.`} okText="End offer" onConfirm={() => end(o)}>
                <Button size="small" danger icon={<StopOutlined />} loading={ending === o.id}>End</Button>
              </Popconfirm>
            )}
          </Space>
        )} />
      </Table>
    </List>
  );
};
