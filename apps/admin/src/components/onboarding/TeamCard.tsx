import { useEffect, useState } from "react";
import { App, Button, Card, Col, Form, Input, Popconfirm, Row, Select, Table, Tag, Typography, type FormInstance } from "antd";
import type { NamePath } from "antd/es/form/interface";
import { TeamOutlined, UserAddOutlined } from "@ant-design/icons";
import { UserRoleLabels } from "@martly/shared/constants";
import { ONBOARDING_STAFF_ROLES, type OnboardingStaffInput } from "@martly/shared/schemas";
import type { OnboardingTeamMember } from "@martly/shared/types";

import { sectionTitle } from "../../theme";
import { errorMessage, onboardingApi } from "../../pages/onboarding/api";

const { Text } = Typography;

type MemberForm = Omit<OnboardingStaffInput, "upgradeShopper">;

const ROLE_OPTIONS = ONBOARDING_STAFF_ROLES.map((r) => ({ value: r, label: UserRoleLabels[r] }));

/** The admin panel signs in with email and password, so a password needs the email at `field` */
export const requireEmail = (field: NamePath) => ({ getFieldValue }: Pick<FormInstance, "getFieldValue">) => ({
  validator: (_: unknown, password?: string) =>
    !password || getFieldValue(field) ? Promise.resolve() : Promise.reject(new Error("Add the email too")),
});

function AddMemberForm({ onAdd }: { onAdd: (values: MemberForm) => Promise<boolean> }) {
  const [form] = Form.useForm<MemberForm>();
  const [adding, setAdding] = useState(false);
  const submit = async (values: MemberForm) => {
    setAdding(true);
    if (await onAdd({ ...values, email: values.email || undefined, password: values.password || undefined })) form.resetFields();
    setAdding(false);
  };

  return (
    <Form form={form} name="team" layout="vertical" onFinish={submit} requiredMark="optional" initialValues={{ role: "STAFF" }}>
      <Row gutter={12}>
        <Col xs={24} md={8}><Form.Item label="Name" name="name" rules={[{ required: true, min: 2 }]}><Input /></Form.Item></Col>
        <Col xs={24} md={8}>
          <Form.Item label="Mobile number" name="phone" rules={[{ required: true, pattern: /^\d{10}$/, message: "10-digit mobile number" }]}>
            <Input addonBefore="+91" maxLength={10} inputMode="numeric" />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}><Form.Item label="Role" name="role" rules={[{ required: true }]}><Select options={ROLE_OPTIONS} /></Form.Item></Col>
        <Col xs={24} md={8}><Form.Item label="Email" name="email" rules={[{ type: "email" }]}><Input placeholder="For the admin panel" /></Form.Item></Col>
        <Col xs={24} md={8}>
          <Form.Item label="Admin panel password" name="password" dependencies={["email"]} rules={[{ min: 8, message: "At least 8 characters" }, requireEmail("email")]}>
            <Input.Password autoComplete="new-password" />
          </Form.Item>
        </Col>
        <Col xs={24} md={8} style={{ display: "flex", alignItems: "flex-end", paddingBottom: 24 }}>
          <Button htmlType="submit" icon={<UserAddOutlined />} loading={adding}>Add to the team</Button>
        </Col>
      </Row>
    </Form>
  );
}

/** Store managers, staff and riders; each signs in to the Martly app by OTP on their phone */
export function TeamCard({ storeId, editable }: { storeId: string; editable: boolean }) {
  const { message, modal } = App.useApp();
  const [team, setTeam] = useState<OnboardingTeamMember[]>();

  useEffect(() => {
    onboardingApi.team(storeId).then(setTeam).catch((err) => message.error(errorMessage(err, "Couldn't load the team")));
  }, [storeId, message]);

  const add = async (values: MemberForm, upgradeShopper = false): Promise<boolean> => {
    try {
      setTeam(await onboardingApi.addTeamMember(storeId, { ...values, upgradeShopper }));
      message.success(`${values.name} added`);
      return true;
    } catch (err) {
      const msg = errorMessage(err, "Couldn't add them");
      if (!upgradeShopper && msg.includes("shopper")) {
        return new Promise((resolve) => modal.confirm({
          title: "This number already shops on Martly",
          content: `${msg}. Their orders and wallet stay with the account.`,
          okText: "Use it for their login",
          onOk: () => add(values, true).then(resolve),
          onCancel: () => resolve(false),
        }));
      }
      message.error(msg);
      return false;
    }
  };

  const remove = async (m: OnboardingTeamMember) => {
    try {
      setTeam(await onboardingApi.removeTeamMember(storeId, m.userId));
    } catch (err) {
      message.error(errorMessage(err, "Couldn't remove them"));
    }
  };

  return (
    <Card size="small" title={sectionTitle(<TeamOutlined />, "Team")} style={{ marginTop: 16 }}>
      <Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
        Each person signs in to the Martly app with an OTP on their number. Add an email and password for the admin panel too.
      </Text>
      <Table<OnboardingTeamMember> rowKey="userId" size="small" loading={!team} dataSource={team} pagination={false}
        locale={{ emptyText: "Only the owner so far" }} style={{ marginBottom: editable ? 16 : 0 }}>
        <Table.Column<OnboardingTeamMember> title="Name" dataIndex="name" />
        <Table.Column<OnboardingTeamMember> title="Mobile" dataIndex="phone" />
        <Table.Column<OnboardingTeamMember> title="Role" render={(_, m) => <Tag>{UserRoleLabels[m.role]}</Tag>} />
        <Table.Column<OnboardingTeamMember> title="Signs in with" render={(_, m) => (m.email ? `OTP, or ${m.email} at the admin panel` : "OTP in the app")} />
        {editable && (
          <Table.Column<OnboardingTeamMember> width={90} render={(_, m) => (
            <Popconfirm title={`Remove ${m.name}?`} description="They lose access to this store." okText="Remove" onConfirm={() => remove(m)}>
              <Button size="small" danger type="text">Remove</Button>
            </Popconfirm>
          )} />
        )}
      </Table>
      {editable && <AddMemberForm onAdd={(v) => add(v)} />}
    </Card>
  );
}
