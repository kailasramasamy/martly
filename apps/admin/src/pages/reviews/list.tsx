import { useState } from "react";
import { List, useTable, DateField } from "@refinedev/antd";
import { Table, Tag, Space, Button, Rate, Image, Modal, Input, message } from "antd";
import { CheckOutlined, CloseOutlined, MessageOutlined } from "@ant-design/icons";
import { useCustomMutation, useInvalidate } from "@refinedev/core";

const STATUS_COLORS: Record<string, string> = { PENDING: "orange", APPROVED: "green", REJECTED: "red" };

export const ReviewList = () => {
  const { tableProps } = useTable({
    resource: "reviews/moderation",
    syncWithLocation: true,
  });
  const { mutate } = useCustomMutation();
  const invalidate = useInvalidate();

  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [replyModal, setReplyModal] = useState<{ visible: boolean; reviewId: string; existingBody: string }>({ visible: false, reviewId: "", existingBody: "" });
  const [replyText, setReplyText] = useState("");
  const [replyLoading, setReplyLoading] = useState(false);

  const handleStatus = (id: string, status: string) => {
    mutate({
      url: `reviews/${id}/status`,
      method: "patch",
      values: { status },
    }, {
      onSuccess: () => invalidate({ resource: "reviews/moderation", invalidates: ["list"] }),
    });
  };

  const handleBulkStatus = async (status: string) => {
    setBulkLoading(true);
    let done = 0;
    for (const id of selectedRowKeys) {
      await new Promise<void>((resolve) => {
        mutate({ url: `reviews/${id}/status`, method: "patch", values: { status } }, {
          onSuccess: () => { done++; resolve(); },
          onError: () => resolve(),
        });
      });
    }
    invalidate({ resource: "reviews/moderation", invalidates: ["list"] });
    setSelectedRowKeys([]);
    setBulkLoading(false);
    message.success(`${done} review(s) ${status.toLowerCase()}`);
  };

  const openReplyModal = (reviewId: string, existingBody: string) => {
    setReplyModal({ visible: true, reviewId, existingBody });
    setReplyText(existingBody);
  };

  const handleReplySubmit = () => {
    if (!replyText.trim()) return;
    setReplyLoading(true);
    mutate({
      url: `reviews/${replyModal.reviewId}/reply`,
      method: "post",
      values: { body: replyText.trim() },
    }, {
      onSuccess: () => {
        setReplyModal({ visible: false, reviewId: "", existingBody: "" });
        setReplyText("");
        invalidate({ resource: "reviews/moderation", invalidates: ["list"] });
        setReplyLoading(false);
      },
      onError: () => setReplyLoading(false),
    });
  };

  const handleReplyDelete = (reviewId: string) => {
    mutate({
      url: `reviews/${reviewId}/reply`,
      method: "delete",
      values: {},
    }, {
      onSuccess: () => invalidate({ resource: "reviews/moderation", invalidates: ["list"] }),
    });
  };

  return (
    <>
      <List resource="reviews" title="Review Moderation"
        headerButtons={() => selectedRowKeys.length > 0 ? (
          <Space>
            <span>{selectedRowKeys.length} selected</span>
            <Button type="primary" icon={<CheckOutlined />} loading={bulkLoading} onClick={() => handleBulkStatus("APPROVED")}>
              Approve All
            </Button>
            <Button danger icon={<CloseOutlined />} loading={bulkLoading} onClick={() => handleBulkStatus("REJECTED")}>
              Reject All
            </Button>
          </Space>
        ) : null}
      >
        <Table {...tableProps} rowKey="id" size="small"
          rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
        >
          <Table.Column dataIndex={["product", "name"]} title="Product" render={(v: string, r: any) => (
            <Space>
              {r.product?.imageUrl && <Image src={r.product.imageUrl} width={32} height={32} style={{ borderRadius: 4, objectFit: "cover" }} preview={false} />}
              <span>{v}</span>
            </Space>
          )} />
          <Table.Column dataIndex={["user", "name"]} title="User" />
          <Table.Column dataIndex="rating" title="Rating" render={(v: number) => <Rate disabled value={v} style={{ fontSize: 14 }} />} />
          <Table.Column dataIndex="comment" title="Comment" ellipsis />
          <Table.Column title="Images" dataIndex="images" render={(images: any[]) => {
            if (!images?.length) return "—";
            return (
              <Image.PreviewGroup>
                <Space size={4}>
                  {images.map((img: any) => (
                    <Image key={img.id} src={img.imageUrl} width={32} height={32} style={{ borderRadius: 4, objectFit: "cover" }} />
                  ))}
                </Space>
              </Image.PreviewGroup>
            );
          }} />
          <Table.Column dataIndex="isVerified" title="Verified" render={(v: boolean) =>
            v ? <Tag color="green">Verified</Tag> : <Tag>Unverified</Tag>
          } />
          <Table.Column dataIndex="status" title="Status" render={(v: string) =>
            <Tag color={STATUS_COLORS[v]}>{v}</Tag>
          } />
          <Table.Column title="Reply" dataIndex="reply" render={(reply: any, r: any) =>
            reply ? (
              <Space direction="vertical" size={2} style={{ maxWidth: 200 }}>
                <span style={{ fontSize: 12, color: "#666" }}>{reply.body.slice(0, 60)}{reply.body.length > 60 ? "..." : ""}</span>
                <Space size={4}>
                  <Button size="small" type="link" onClick={() => openReplyModal(r.id, reply.body)}>Edit</Button>
                  <Button size="small" type="link" danger onClick={() => handleReplyDelete(r.id)}>Delete</Button>
                </Space>
              </Space>
            ) : (
              <Button size="small" icon={<MessageOutlined />} onClick={() => openReplyModal(r.id, "")}>Reply</Button>
            )
          } />
          <Table.Column dataIndex="createdAt" title="Date" render={(v: string) => <DateField value={v} format="DD MMM YYYY" />} />
          <Table.Column title="Actions" render={(_, r: any) => (
            <Space>
              {r.status !== "APPROVED" && (
                <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => handleStatus(r.id, "APPROVED")}>
                  Approve
                </Button>
              )}
              {r.status !== "REJECTED" && (
                <Button size="small" danger icon={<CloseOutlined />} onClick={() => handleStatus(r.id, "REJECTED")}>
                  Reject
                </Button>
              )}
            </Space>
          )} />
        </Table>
      </List>

      <Modal
        title="Reply to Review"
        open={replyModal.visible}
        onOk={handleReplySubmit}
        onCancel={() => setReplyModal({ visible: false, reviewId: "", existingBody: "" })}
        confirmLoading={replyLoading}
        okText={replyModal.existingBody ? "Update Reply" : "Post Reply"}
      >
        <Input.TextArea
          rows={4}
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          placeholder="Write your response to this review..."
          maxLength={2000}
          showCount
        />
      </Modal>
    </>
  );
};
