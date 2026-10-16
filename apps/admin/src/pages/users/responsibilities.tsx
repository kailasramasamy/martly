import { useCallback, useEffect, useRef, useState } from "react";
import { Card, Checkbox, Empty, Space, Tag, Typography, message } from "antd";
import { SafetyCertificateOutlined } from "@ant-design/icons";
import type { Permission } from "@martly/shared/constants";
import { PERMISSION_GROUPS, PERMISSION_META, ROLE_ADDONS, ROLE_PERMISSIONS } from "@martly/shared/permissions";
import { axiosInstance } from "../../providers/data-provider";
import { sectionTitle } from "../../theme";

/** A member's owner-granted add-ons in the current organization; `inOrg` is false until they're assigned a store */
export function useMemberAddOns(userId: string | undefined) {
  const [addOns, setAddOns] = useState<Permission[]>([]);
  const [inOrg, setInOrg] = useState<boolean | null>(null);
  // Refs keep `save` stable so a form callback captured on first render still sees current state
  const latest = useRef({ addOns, inOrg });
  latest.current = { addOns, inOrg };

  useEffect(() => {
    if (!userId) return;
    axiosInstance
      .get(`/users/${userId}/permissions`)
      .then((res) => {
        setAddOns(res.data.data.addOns);
        setInOrg(true);
      })
      .catch((err) => {
        if (err?.response?.status === 404) setInOrg(false);
        else message.error(err?.response?.data?.message ?? "Couldn't load responsibilities");
      });
  }, [userId]);

  /** Saves the add-ons the given role may hold (role changes drop the rest on the server too) */
  const save = useCallback(async (role: string) => {
    if (!userId || !latest.current.inOrg) return;
    const allowed = ROLE_ADDONS[role] ?? [];
    await axiosInstance.put(`/users/${userId}/permissions`, {
      permissions: latest.current.addOns.filter((p) => allowed.includes(p)),
    });
  }, [userId]);

  return { addOns, setAddOns, inOrg, save };
}

interface ResponsibilitiesCardProps {
  role: string | undefined;
  inOrg: boolean | null;
  value: Permission[];
  onChange: (next: Permission[]) => void;
}

/** What the member's role includes, plus the extra responsibilities an owner can switch on */
export function ResponsibilitiesCard({ role, inOrg, value, onChange }: ResponsibilitiesCardProps) {
  const included = (role && ROLE_PERMISSIONS[role]) || [];
  const grantable = (role && ROLE_ADDONS[role]) || [];
  const title = sectionTitle(<SafetyCertificateOutlined />, "Responsibilities");

  if (!role || role === "ORG_ADMIN" || role === "SUPER_ADMIN") {
    return <Card title={title} size="small"><Typography.Text type="secondary">Owners can do everything in their organization.</Typography.Text></Card>;
  }
  if (inOrg === false) {
    return <Card title={title} size="small"><Empty description="Assign this member to a store first, then choose their responsibilities." /></Card>;
  }

  const toggle = (p: Permission, on: boolean) => onChange(on ? [...value, p] : value.filter((v) => v !== p));

  return (
    <Card title={title} size="small">
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        {PERMISSION_GROUPS.map((group) => {
          const perms = (Object.keys(PERMISSION_META) as Permission[])
            .filter((p) => PERMISSION_META[p].group === group && (included.includes(p) || grantable.includes(p)));
          if (perms.length === 0) return null;
          return (
            <div key={group}>
              <Typography.Text strong>{group}</Typography.Text>
              <Space direction="vertical" size={6} style={{ width: "100%", marginTop: 6 }}>
                {perms.map((p) => {
                  const isIncluded = included.includes(p);
                  return (
                    <Checkbox key={p} checked={isIncluded || value.includes(p)} disabled={isIncluded} onChange={(e) => toggle(p, e.target.checked)}>
                      {PERMISSION_META[p].label}
                      {isIncluded && <Tag style={{ marginLeft: 8 }}>Included</Tag>}
                      <div style={{ color: "#64748b", fontSize: 12 }}>{PERMISSION_META[p].description}</div>
                    </Checkbox>
                  );
                })}
              </Space>
            </div>
          );
        })}
      </Space>
    </Card>
  );
}
