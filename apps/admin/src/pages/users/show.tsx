import { useEffect, useState } from "react";
import { Show, EditButton } from "@refinedev/antd";
import { useShow, useGetIdentity } from "@refinedev/core";
import { Avatar, Card, Col, Descriptions, Empty, List, Row, Space, Tag, Typography, message } from "antd";
import { CheckOutlined, ShopOutlined, SafetyCertificateOutlined, UserOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { UserRoleLabels, type Permission, type UserRole } from "@martly/shared/constants";
import { PERMISSION_GROUPS, PERMISSION_META, ROLE_ADDONS, ROLE_PERMISSIONS, can, type PermissionSubject } from "@martly/shared/permissions";
import { axiosInstance } from "../../providers/data-provider";
import { sectionTitle } from "../../theme";
import { ReadableSection } from "../../components/ReadableSection";

interface MemberRecord {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  createdAt: string;
  userStores: { store: { id: string; name: string } }[];
}

const ROLE_COLORS: Record<string, string> = { SUPER_ADMIN: "red", ORG_ADMIN: "blue", STORE_MANAGER: "green", STAFF: "gold", RIDER: "cyan" };

/** Owner-granted add-ons for this member in the current organization (none for super admins) */
function useAddOns(userId: string | undefined, enabled: boolean) {
  const [addOns, setAddOns] = useState<Permission[]>([]);
  useEffect(() => {
    if (!userId || !enabled) return;
    axiosInstance
      .get(`/users/${userId}/permissions`)
      .then((res) => setAddOns(res.data.data.addOns))
      .catch((err) => {
        // 404: not in this organization yet, so nothing has been granted
        if (err?.response?.status !== 404) message.error(err?.response?.data?.message ?? "Couldn't load responsibilities");
      });
  }, [userId, enabled]);
  return addOns;
}

/** Responsibilities of a group, in catalogue order */
const inGroup = (group: string, perms: readonly Permission[]) =>
  (Object.keys(PERMISSION_META) as Permission[]).filter((p) => PERMISSION_META[p].group === group && perms.includes(p));

/** Read-only summary: what the member can do (from their role or added by the owner), then what they don't have */
function Responsibilities({ role, addOns }: { role: string; addOns: Permission[] }) {
  const title = sectionTitle(<SafetyCertificateOutlined />, "Can do");
  if (role === "ORG_ADMIN" || role === "SUPER_ADMIN") {
    return <Card title={title} size="small"><Typography.Text type="secondary">Owners can do everything in their organization.</Typography.Text></Card>;
  }
  const included = ROLE_PERMISSIONS[role] ?? [];
  const optional = ROLE_ADDONS[role] ?? [];
  const added = addOns.filter((p) => optional.includes(p));
  const missing = optional.filter((p) => !added.includes(p));
  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Card title={title} size="small">
        {PERMISSION_GROUPS.map((group) => {
          const perms = inGroup(group, [...included, ...added]);
          if (perms.length === 0) return null;
          return (
            <div key={group} style={{ marginBottom: 12 }}>
              <Typography.Text strong type="secondary" style={{ fontSize: 12, textTransform: "uppercase" }}>{group}</Typography.Text>
              {perms.map((p) => (
                <div key={p} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "6px 0" }}>
                  <CheckOutlined style={{ color: "#0d9488", marginTop: 4 }} />
                  <div style={{ flex: 1 }}>
                    <Typography.Text>{PERMISSION_META[p].label}</Typography.Text>
                    <div style={{ color: "#64748b", fontSize: 12 }}>{PERMISSION_META[p].description}</div>
                  </div>
                  {included.includes(p) ? <Tag>Role</Tag> : <Tag color="cyan">Added</Tag>}
                </div>
              ))}
            </div>
          );
        })}
      </Card>
      {missing.length > 0 && (
        <Card title="Not assigned" size="small">
          {PERMISSION_GROUPS.map((group) => {
            const perms = inGroup(group, missing);
            if (perms.length === 0) return null;
            return (
              <Typography.Paragraph key={group} type="secondary" style={{ marginBottom: 6 }}>
                <Typography.Text strong>{group}: </Typography.Text>
                {perms.map((p) => PERMISSION_META[p].label).join(", ")}
              </Typography.Paragraph>
            );
          })}
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>Use Edit to assign any of these.</Typography.Text>
        </Card>
      )}
    </Space>
  );
}

export const UserShow = () => {
  const { query } = useShow<MemberRecord>({ resource: "users" });
  const member = query.data?.data;
  const { data: identity } = useGetIdentity<PermissionSubject>();
  const addOns = useAddOns(member?.id, !!identity && identity.role !== "SUPER_ADMIN");
  const canEdit = can(identity, "users", "edit") && member?.role !== "SUPER_ADMIN"
    && (identity?.role === "SUPER_ADMIN" || member?.role !== "ORG_ADMIN");

  return (
    <Show isLoading={query.isLoading} title={member?.name} headerButtons={canEdit && member ? <EditButton recordItemId={member.id} /> : null}>
      <ReadableSection>
        {member && (
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={10}>
              <Card size="small" title={sectionTitle(<UserOutlined />, "Profile")}>
                <Space align="center" size={14} style={{ marginBottom: 12 }}>
                  <Avatar size={52} style={{ background: "#0d9488" }}>{member.name.slice(0, 1).toUpperCase()}</Avatar>
                  <div>
                    <Typography.Title level={5} style={{ margin: 0 }}>{member.name}</Typography.Title>
                    <Tag color={ROLE_COLORS[member.role]}>{UserRoleLabels[member.role]}</Tag>
                  </div>
                </Space>
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="Email">{member.email}</Descriptions.Item>
                  <Descriptions.Item label="Phone">{member.phone ?? "—"}</Descriptions.Item>
                  <Descriptions.Item label="Joined">{dayjs(member.createdAt).format("D MMM YYYY")}</Descriptions.Item>
                </Descriptions>
              </Card>
              <Card size="small" title={sectionTitle(<ShopOutlined />, "Stores")} style={{ marginTop: 16 }}>
                {member.userStores.length === 0
                  ? <Empty description="No stores assigned" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                  : <List size="small" dataSource={member.userStores} renderItem={({ store }) => <List.Item>{store.name}</List.Item>} />}
              </Card>
            </Col>
            <Col xs={24} lg={14}>
              <Responsibilities role={member.role} addOns={addOns} />
            </Col>
          </Row>
        )}
      </ReadableSection>
    </Show>
  );
};
