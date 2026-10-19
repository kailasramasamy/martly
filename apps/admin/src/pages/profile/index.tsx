import { useEffect, useState } from "react";
import { useGetIdentity, useInvalidateAuthStore } from "@refinedev/core";
import { Button, Card, Col, Descriptions, Form, Input, Row, Space, Typography, message } from "antd";
import { PhoneOutlined, UserOutlined } from "@ant-design/icons";
import { isAxiosError } from "axios";
import { axiosInstance } from "../../providers/data-provider";
import { sectionTitle } from "../../theme";
import { ReadableSection } from "../../components/ReadableSection";

interface Me {
  name: string;
  email: string;
  phone: string | null;
}

const errorText = (err: unknown, fallback: string): string =>
  (isAxiosError(err) && err.response?.data?.message) || fallback;

/** A new number is saved only after the code texted to it is verified — the phone doubles as an OTP login */
function PhoneCard({ current, onChanged }: { current: string | null; onChanged: () => void }) {
  const [step, setStep] = useState<"idle" | "number" | "code">("idle");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const call = async (fn: () => Promise<unknown>, fallback: string) => {
    setBusy(true);
    try {
      await fn();
      return true;
    } catch (err) {
      message.error(errorText(err, fallback));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const sendCode = async () => {
    if (await call(() => axiosInstance.post("/auth/phone/otp", { phone: phone.trim() }), "Couldn't send the code")) setStep("code");
  };
  const verify = async () => {
    if (!(await call(() => axiosInstance.post("/auth/phone/verify", { phone: phone.trim(), otp: code.trim() }), "Couldn't verify the code"))) return;
    message.success("Phone number updated");
    setStep("idle");
    onChanged();
  };

  return (
    <Card size="small" title={sectionTitle(<PhoneOutlined />, "Phone")}>
      {step === "idle" ? (
        <Space style={{ width: "100%", justifyContent: "space-between" }}>
          <Typography.Text>{current ?? <Typography.Text type="secondary">No phone added</Typography.Text>}</Typography.Text>
          <Button onClick={() => { setPhone(""); setCode(""); setStep("number"); }}>{current ? "Change" : "Add phone"}</Button>
        </Space>
      ) : (
        <Space direction="vertical" style={{ width: "100%" }}>
          {step === "number"
            ? <Input placeholder="New 10-digit mobile number" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={15} autoFocus />
            : <Input placeholder={`6-digit code sent to ${phone}`} value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} autoFocus />}
          <Space>
            <Button onClick={() => setStep("idle")}>Cancel</Button>
            <Button type="primary" loading={busy} onClick={step === "number" ? sendCode : verify}>
              {step === "number" ? "Send code" : "Verify & save"}
            </Button>
          </Space>
        </Space>
      )}
    </Card>
  );
}

export const ProfilePage = () => {
  const { data: me } = useGetIdentity<Me>();
  const invalidateIdentity = useInvalidateAuthStore();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => setName(me?.name ?? ""), [me?.name]);
  // Phone sign-ups get a placeholder email, so only real addresses are shown
  const email = me?.email?.endsWith("@phone.martly.app") ? null : me?.email;

  const saveName = async () => {
    setSaving(true);
    try {
      await axiosInstance.put("/auth/profile", { name: name.trim() });
      message.success("Profile updated");
      invalidateIdentity();
    } catch (err) {
      message.error(errorText(err, "Couldn't update profile"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ReadableSection>
      <Row gutter={[16, 16]}>
        <Col xs={24}><Typography.Title level={4} style={{ margin: 0 }}>My profile</Typography.Title></Col>
        <Col xs={24} lg={12}>
          <Card size="small" title={sectionTitle(<UserOutlined />, "Details")}>
            <Form layout="vertical" onFinish={saveName}>
              <Form.Item label="Name" required>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </Form.Item>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Login email">{email ?? "—"}</Descriptions.Item>
              </Descriptions>
              <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
                Ask your owner or the platform admin to change your login email.
              </Typography.Paragraph>
              <Button type="primary" htmlType="submit" loading={saving} disabled={!name.trim() || name.trim() === me?.name}>
                Save changes
              </Button>
            </Form>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <PhoneCard current={me?.phone ?? null} onChanged={invalidateIdentity} />
        </Col>
      </Row>
    </ReadableSection>
  );
};
