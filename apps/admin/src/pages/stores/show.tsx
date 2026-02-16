import { useState, useEffect, useCallback } from "react";
import { Show } from "@refinedev/antd";
import { useShow, useOne, useGetIdentity } from "@refinedev/core";
import { Tag, Button, Card, Descriptions, Row, Col, Table, Select, Space, Popconfirm, App } from "antd";
import { useNavigate } from "react-router";
import { ShopOutlined, EnvironmentOutlined, TeamOutlined, UserAddOutlined, DeleteOutlined } from "@ant-design/icons";

import { STORE_STATUS_CONFIG } from "../../constants/tag-colors";
import { sectionTitle } from "../../theme";
import { axiosInstance } from "../../providers/data-provider";

interface Identity {
  role: string;
}

interface StaffAssignment {
  id: string;
  userId: string;
  storeId: string;
  role: string;
  createdAt: string;
  user: { id: string; email: string; name: string; phone?: string; role: string };
}

interface UserOption {
  id: string;
  name: string;
  email: string;
  role: string;
}

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: "red",
  ORG_ADMIN: "blue",
  STORE_MANAGER: "green",
  STAFF: "orange",
};

export const StoreShow = () => {
  const { query } = useShow({ resource: "stores" });
  const record = query?.data?.data;
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { data: identity } = useGetIdentity<Identity>();

  const canManageStaff = identity?.role === "SUPER_ADMIN" || identity?.role === "ORG_ADMIN";

  const { data: orgData } = useOne({
    resource: "organizations",
    id: record?.organizationId,
    queryOptions: { enabled: !!record?.organizationId },
  });

  // Staff management state
  const [staff, setStaff] = useState<StaffAssignment[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>();
  const [assigning, setAssigning] = useState(false);

  const loadStaff = useCallback(async () => {
    if (!record?.id || !canManageStaff) return;
    setStaffLoading(true);
    try {
      const { data: res } = await axiosInstance.get(`/stores/${record.id}/staff`);
      setStaff(res.data);
    } catch {
      // ignore
    } finally {
      setStaffLoading(false);
    }
  }, [record?.id, canManageStaff]);

  const loadUsers = useCallback(async () => {
    if (!canManageStaff) return;
    try {
      const { data: res } = await axiosInstance.get("/users", { params: { pageSize: 200 } });
      setUsers(res.data);
    } catch {
      // ignore
    }
  }, [canManageStaff]);

  useEffect(() => {
    loadStaff();
    loadUsers();
  }, [loadStaff, loadUsers]);

  const handleAssign = async () => {
    if (!selectedUserId || !record?.id) return;
    setAssigning(true);
    try {
      await axiosInstance.post(`/stores/${record.id}/staff`, { userId: selectedUserId });
      message.success("User assigned to store");
      setSelectedUserId(undefined);
      loadStaff();
    } catch (err: unknown) {
      const errorMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed to assign user";
      message.error(errorMsg);
    } finally {
      setAssigning(false);
    }
  };

  const handleRemove = async (userId: string) => {
    if (!record?.id) return;
    try {
      await axiosInstance.delete(`/stores/${record.id}/staff/${userId}`);
      message.success("User removed from store");
      loadStaff();
    } catch {
      message.error("Failed to remove user");
    }
  };

  if (!record) return null;

  const statusConfig = STORE_STATUS_CONFIG[record.status] ?? { color: "default", label: record.status };

  // Filter out users already assigned to this store
  const assignedUserIds = new Set(staff.map((s) => s.userId));
  const availableUsers = users.filter((u) => !assignedUserIds.has(u.id));

  return (
    <Show>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title={sectionTitle(<ShopOutlined />, "Store Details")} size="small">
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Name">{record.name}</Descriptions.Item>
              <Descriptions.Item label="Slug">{record.slug}</Descriptions.Item>
              <Descriptions.Item label="Organization">
                {orgData?.data?.name ?? record.organizationId}
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={statusConfig.color}>{statusConfig.label}</Tag>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title={sectionTitle(<EnvironmentOutlined />, "Contact & Location")} size="small">
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Address">{record.address}</Descriptions.Item>
              <Descriptions.Item label="Phone">{record.phone ?? "—"}</Descriptions.Item>
              <Descriptions.Item label="Created">
                {record.createdAt ? new Date(record.createdAt).toLocaleString() : "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Last Updated">
                {record.updatedAt ? new Date(record.updatedAt).toLocaleString() : "—"}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24}>
          <Button type="primary" onClick={() => navigate(`/stores/show/${record.id}/onboard`)}>
            Onboard Products
          </Button>
        </Col>

        {canManageStaff && (
          <Col xs={24}>
            <Card
              title={sectionTitle(<TeamOutlined />, "Store Staff")}
              size="small"
              extra={
                <Space>
                  <Select
                    showSearch
                    allowClear
                    placeholder="Select user to assign"
                    value={selectedUserId}
                    onChange={setSelectedUserId}
                    style={{ width: 280 }}
                    optionFilterProp="label"
                    options={availableUsers.map((u) => ({
                      label: `${u.name} (${u.email})`,
                      value: u.id,
                    }))}
                  />
                  <Button
                    type="primary"
                    icon={<UserAddOutlined />}
                    onClick={handleAssign}
                    loading={assigning}
                    disabled={!selectedUserId}
                  >
                    Assign
                  </Button>
                </Space>
              }
            >
              <Table
                dataSource={staff}
                rowKey="id"
                loading={staffLoading}
                pagination={false}
                size="small"
              >
                <Table.Column
                  title="Name"
                  render={(_, row: StaffAssignment) => row.user.name}
                />
                <Table.Column
                  title="Email"
                  render={(_, row: StaffAssignment) => row.user.email}
                />
                <Table.Column
                  title="Role"
                  render={(_, row: StaffAssignment) => (
                    <Tag color={ROLE_COLORS[row.user.role] ?? "default"}>
                      {row.user.role.replace(/_/g, " ")}
                    </Tag>
                  )}
                />
                <Table.Column
                  title="Assigned"
                  render={(_, row: StaffAssignment) =>
                    new Date(row.createdAt).toLocaleDateString()
                  }
                />
                <Table.Column
                  title=""
                  width={60}
                  render={(_, row: StaffAssignment) => (
                    <Popconfirm
                      title="Remove this user from the store?"
                      onConfirm={() => handleRemove(row.userId)}
                    >
                      <Button
                        danger
                        type="text"
                        size="small"
                        icon={<DeleteOutlined />}
                      />
                    </Popconfirm>
                  )}
                />
              </Table>
            </Card>
          </Col>
        )}
      </Row>
    </Show>
  );
};
