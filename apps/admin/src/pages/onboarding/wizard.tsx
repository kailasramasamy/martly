import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { Button, Card, Space, Spin, Steps, Tag, Typography, App } from "antd";
import { ArrowLeftOutlined, RocketOutlined } from "@ant-design/icons";
import { STORE_SIZE_RULES } from "@martly/shared/constants";

import { sectionTitle } from "../../theme";
import { errorMessage, onboardingApi, STEPS, type Onboarding } from "./api";
import { BusinessStep, type BusinessDraft } from "../../components/onboarding/BusinessStep";
import { StoreStep } from "../../components/onboarding/StoreStep";
import { SizeStep } from "../../components/onboarding/SizeStep";
import { CatalogStep } from "../../components/onboarding/catalog/CatalogStep";
import { StorefrontStep } from "../../components/onboarding/StorefrontStep";
import { LaunchStep } from "../../components/onboarding/LaunchStep";

const { Text } = Typography;

/** The first step a saved store still needs, for reopening the wizard where it was left */
function resumeStep(o: Onboarding) {
  if (!o.size) return 2;
  if (o.listings === 0) return 3;
  if (!o.storefrontCopied) return 4;
  return 5;
}

export const OnboardingWizard = () => {
  const { message } = App.useApp();
  const { storeId = "new" } = useParams<{ storeId: string }>();
  const isNew = storeId === "new";
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [onboarding, setOnboarding] = useState<Onboarding>();
  const [business, setBusiness] = useState<BusinessDraft>();

  const reload = useCallback(async () => {
    if (isNew) return;
    try {
      setOnboarding(await onboardingApi.get(storeId));
    } catch (err) {
      message.error(errorMessage(err, "Couldn't load this store"));
    }
  }, [isNew, storeId]);

  useEffect(() => { void reload(); }, [reload]);

  const requested = params.get("step");
  const step = requested !== null ? Number(requested) : onboarding ? resumeStep(onboarding) : 0;
  const goTo = (n: number) => setParams({ step: String(n) });

  // Fix the resumed step in the URL, so finishing a step doesn't move the page on by itself
  useEffect(() => {
    if (requested === null && onboarding) setParams({ step: String(resumeStep(onboarding)) }, { replace: true });
  }, [requested, onboarding, setParams]);

  if (!isNew && !onboarding) return <Spin style={{ display: "block", margin: "80px auto" }} />;

  const launched = onboarding?.status === "ACTIVE";
  const title = onboarding ? `${onboarding.storeName} · ${onboarding.organization.name}` : "New store";

  return (
    <Card
      title={sectionTitle(<RocketOutlined />, title)}
      extra={
        <Space>
          {onboarding?.region && <Tag color="cyan">{onboarding.region}</Tag>}
          {onboarding?.size && <Tag>{STORE_SIZE_RULES[onboarding.size].label}</Tag>}
          {launched ? <Tag color="green">Live</Tag> : <Tag color="gold">Hidden until launch</Tag>}
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/onboarding")}>All stores</Button>
        </Space>
      }
    >
      <Steps
        current={step}
        size="small"
        style={{ marginBottom: 24 }}
        onChange={isNew ? undefined : goTo}
        items={STEPS.map((title, i) => ({ title, disabled: isNew && i > 1 }))}
      />
      {launched && step < 5 && <Text type="warning" style={{ display: "block", marginBottom: 16 }}>This store is live: manage it from Stores from now on.</Text>}

      {step === 0 && (
        <BusinessStep
          onboarding={onboarding}
          draft={business}
          onDone={(draft) => { if (draft) setBusiness(draft); else void reload(); goTo(1); }}
        />
      )}
      {step === 1 && (
        <StoreStep
          onboarding={onboarding}
          business={business}
          onBack={() => goTo(0)}
          onCreated={(created) => navigate(`/onboarding/${created.storeId}?step=2`)}
          onSaved={(saved) => { setOnboarding(saved); goTo(2); }}
        />
      )}
      {onboarding && step === 2 && <SizeStep onboarding={onboarding} onSaved={(saved) => { setOnboarding(saved); goTo(3); }} />}
      {onboarding && step === 3 && <CatalogStep onboarding={onboarding} onChanged={reload} onNext={() => goTo(4)} />}
      {onboarding && step === 4 && <StorefrontStep onboarding={onboarding} onChanged={reload} onNext={() => goTo(5)} />}
      {onboarding && step === 5 && <LaunchStep onboarding={onboarding} onGoTo={goTo} onLaunched={setOnboarding} />}
    </Card>
  );
};
