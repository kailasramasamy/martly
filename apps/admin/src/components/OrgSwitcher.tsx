import { useGetIdentity } from "@refinedev/core";
import { Select, Typography, Space } from "antd";
import { BankOutlined, ShopOutlined } from "@ant-design/icons";
import { selectOrganization } from "../providers/auth-provider";

const { Text } = Typography;

interface Identity {
  id: string;
  name: string;
  email: string;
  role: string;
  organizationId?: string;
  organizations: Array<{ id: string; name: string; slug: string }>;
  stores?: Array<{ id: string; name: string }>;
}

export const OrgSwitcher = () => {
  const { data: identity } = useGetIdentity<Identity>();

  if (!identity) return null;

  const iconStyle = { color: "rgba(255,255,255,0.85)" };
  const textStyle = { color: "rgba(255,255,255,0.85)" };
  const dimStyle = { color: "rgba(255,255,255,0.45)" };

  // SUPER_ADMIN: show "All Organizations" label
  if (identity.role === "SUPER_ADMIN") {
    return (
      <Space>
        <BankOutlined style={iconStyle} />
        <Text style={textStyle}>All Organizations</Text>
      </Space>
    );
  }

  const orgs = identity.organizations || [];
  const stores = identity.stores || [];

  // No orgs (shouldn't happen for org-scoped users, but guard)
  if (orgs.length === 0) return null;

  // Find current org name
  const currentOrg = orgs.find((o) => o.id === identity.organizationId) ?? orgs[0];

  // STORE_MANAGER / STAFF: show org / store name(s)
  if (identity.role === "STORE_MANAGER" || identity.role === "STAFF") {
    const storeLabel = stores.length === 1
      ? stores[0].name
      : stores.length > 1
        ? `${stores.length} stores`
        : "No store";
    return (
      <Space>
        <BankOutlined style={iconStyle} />
        <Text style={textStyle}>{currentOrg.name}</Text>
        <Text style={dimStyle}>/</Text>
        <ShopOutlined style={iconStyle} />
        <Text style={textStyle}>{storeLabel}</Text>
      </Space>
    );
  }

  // Single org: show org name
  if (orgs.length === 1) {
    return (
      <Space>
        <BankOutlined style={iconStyle} />
        <Text style={textStyle}>{orgs[0].name}</Text>
      </Space>
    );
  }

  // Multi-org: show dropdown
  const handleSwitch = async (orgId: string) => {
    try {
      await selectOrganization(orgId);
      window.location.href = "/";
    } catch {
      // Silently fail — user stays on current org
    }
  };

  return (
    <Select
      value={identity.organizationId}
      onChange={handleSwitch}
      style={{ minWidth: 180 }}
      options={orgs.map((org) => ({ label: org.name, value: org.id }))}
    />
  );
};
