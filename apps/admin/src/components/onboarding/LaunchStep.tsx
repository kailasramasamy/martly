import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Button, Card, List, Popconfirm, Result, Space, Tag, Typography, App } from "antd";
import { CheckCircleFilled, CloseCircleFilled, ExclamationCircleFilled, RocketOutlined } from "@ant-design/icons";
import type { ReadinessCheck } from "@martly/shared/types";

import { BRAND, sectionTitle } from "../../theme";
import { ReadableSection } from "../ReadableSection";
import { errorMessage, onboardingApi, STEPS, type Onboarding } from "../../pages/onboarding/api";

const { Text } = Typography;

function CheckIcon({ check }: { check: ReadinessCheck }) {
  if (check.ok) return <CheckCircleFilled style={{ color: BRAND.success, fontSize: 18 }} />;
  if (check.required) return <CloseCircleFilled style={{ color: BRAND.error, fontSize: 18 }} />;
  return <ExclamationCircleFilled style={{ color: BRAND.warning, fontSize: 18 }} />;
}

interface Props { onboarding: Onboarding; onGoTo: (step: number) => void; onLaunched: (o: Onboarding) => void }

/** Everything checked in one place; launch makes the store visible to shoppers */
export function LaunchStep({ onboarding, onGoTo, onLaunched }: Props) {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [checks, setChecks] = useState<ReadinessCheck[]>();
  const [launching, setLaunching] = useState(false);

  useEffect(() => {
    onboardingApi.readiness(onboarding.storeId).then(setChecks).catch((err) => message.error(errorMessage(err, "Couldn't check readiness")));
  }, [onboarding.storeId, onboarding.status]);

  if (onboarding.status === "ACTIVE") {
    return (
      <Result status="success" title={`${onboarding.storeName} is live`}
        subTitle={`Shoppers nearby can find it now. ${onboarding.owner?.name ?? "The owner"} signs in with OTP on ${onboarding.owner?.phone ?? "their phone"}.`}
        extra={<Button type="primary" onClick={() => navigate(`/stores/show/${onboarding.storeId}`)}>Open the store</Button>} />
    );
  }

  const blocking = checks?.filter((c) => c.required && !c.ok) ?? [];
  const launch = async () => {
    setLaunching(true);
    try {
      onLaunched(await onboardingApi.launch(onboarding.storeId));
      message.success("Launched");
    } catch (err) {
      message.error(errorMessage(err, "Couldn't launch"));
    } finally {
      setLaunching(false);
    }
  };

  return (
    <ReadableSection>
      <Card size="small" title={sectionTitle(<RocketOutlined />, "Ready to launch?")} loading={!checks}>
        <List
          dataSource={checks}
          renderItem={(c) => (
            <List.Item actions={c.ok ? [] : [<Button key="fix" size="small" onClick={() => onGoTo(c.step)}>Fix in {STEPS[c.step]}</Button>]}>
              <Space align="start">
                <CheckIcon check={c} />
                <div>
                  <Text strong={!c.ok}>{c.label}</Text> {!c.required && !c.ok && <Tag>Optional</Tag>}
                  {c.detail && <div><Text type="secondary" style={{ fontSize: 12 }}>{c.detail}</Text></div>}
                </div>
              </Space>
            </List.Item>
          )}
        />
      </Card>
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12, marginTop: 16 }}>
        {blocking.length > 0 && <Text type="danger">{blocking.length} required {blocking.length === 1 ? "check" : "checks"} left</Text>}
        <Popconfirm title="Launch the store?" description="Shoppers nearby will see it and can order straight away." okText="Launch" onConfirm={launch} disabled={blocking.length > 0}>
          <Button type="primary" icon={<RocketOutlined />} loading={launching} disabled={!checks || blocking.length > 0}>Launch</Button>
        </Popconfirm>
      </div>
    </ReadableSection>
  );
}
