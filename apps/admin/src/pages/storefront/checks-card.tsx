import { Button, Card, List, Space, Tag, Typography } from "antd";
import { Link } from "react-router";
import { HERO_CARD_GUIDE, STOREFRONT_CHECKS, type HeroCardKind, type StorefrontCheckMeta, STOREFRONT_GROUPS, STOREFRONT_GROUP_LABELS } from "@martly/shared/constants";
import type { StorefrontCheckResult, StorefrontHealth, StorefrontSuggestion } from "@martly/shared/types";

import { ReadableSection } from "../../components/ReadableSection";

export type DraftAction = "BRANDING" | "POST" | "OFFER_PICKS";

const STATUS_COLOR = { ON: "green", PARTIAL: "gold", STALE: "orange", OFF: "red", NA: "default" } as const;
const EVIDENCE = {
  DEALS_SELL: "Deal rows drive your Home sales",
  UNDERPERFORMING: "Live but shoppers aren't tapping",
  FESTIVAL_SOON: "Festival coming up",
} as const;

const adminLink = (path: string, storeId: string) => path.replace(":storeId", storeId);
const isDraftable = (ai?: string): ai is DraftAction => ai === "BRANDING" || ai === "POST" || ai === "OFFER_PICKS";

function StatusTag({ check }: { check: StorefrontCheckResult }) {
  const label = check.status === "PARTIAL" ? `PARTIAL ${check.have ?? 0}/${check.need ?? 0}` : check.status;
  return (
    <Space size={4}>
      <Tag color={STATUS_COLOR[check.status]}>{label}</Tag>
      {check.underperforming && <Tag color="volcano">Not working</Tag>}
    </Space>
  );
}

// Each hero card the layout asks for: ready, or what it still needs
function HeroCards({ cards }: { cards: StorefrontCheckResult["cards"] }) {
  if (!cards?.length) return null;
  return (
    <Space direction="vertical" size={0} style={{ display: "flex", marginTop: 6 }}>
      {cards.map((c, i) => {
        const guide = HERO_CARD_GUIDE[c.kind as HeroCardKind];
        const name = c.title ? `${guide.name.en} · ${c.title}` : guide.name.en;
        return (
          <Typography.Text key={`${c.kind}-${c.collectionId ?? i}`} type={c.ready ? "success" : "warning"} style={{ fontSize: 12 }}>
            {c.ready ? `✓ ${name}` : `○ ${name}: ${guide.needs.en}`}
          </Typography.Text>
        );
      })}
    </Space>
  );
}

interface Props {
  storeId: string;
  health: StorefrontHealth;
  onDraft: (action: DraftAction) => void;
}

// "0 of 2 banners live" for counted checks
function statusLine(check: StorefrontCheckResult | undefined, meta: StorefrontCheckMeta) {
  if (!check || check.have === undefined || check.need === undefined || !meta.unit) return null;
  return check.have >= check.need ? `${check.have} ${meta.unit.en}` : `${check.have} of ${check.need} ${meta.unit.en}`;
}

// What setting it up spends from the plan, and whether there's any left
function AllowanceNote({ meta, allowance }: { meta: StorefrontCheckMeta & { uses: NonNullable<StorefrontCheckMeta["uses"]> }; allowance: StorefrontHealth["allowance"] }) {
  const left = meta.uses === "PROMOTION" ? allowance.promotions : allowance.aiImages;
  const what = meta.uses === "PROMOTION" ? "promotion" : "AI image";
  return left > 0
    ? <Typography.Text type="secondary" style={{ fontSize: 12 }}>Uses 1 {what} · {left} left this month</Typography.Text>
    : <Tag color="volcano">No {what}s left: plan upgrade or top-up needed</Tag>;
}

function SuggestionRow({ s, storeId, health, onDraft }: { s: StorefrontSuggestion; storeId: string; health: StorefrontHealth; onDraft: Props["onDraft"] }) {
  const meta: StorefrontCheckMeta = STOREFRONT_CHECKS[s.key];
  const check = health.checks.find((c) => c.key === s.key);
  const line = statusLine(check, meta);
  const draft = isDraftable(meta.ai) ? meta.ai : null;
  return (
    <List.Item actions={[
      <Link key="open" to={adminLink(meta.adminPath, storeId)}>Open</Link>,
      draft && <Button key="ai" size="small" type="primary" ghost onClick={() => onDraft(draft)}>Draft with AI</Button>,
    ].filter(Boolean)}>
      <List.Item.Meta
        title={<Space>{meta.title.en}<Tag color="green">+{s.gain} pts</Tag></Space>}
        description={<>
          {meta.why.en}
          {line && <div><Typography.Text strong style={{ fontSize: 12 }}>Now: {line}</Typography.Text></div>}
          <HeroCards cards={check?.cards} />
          {meta.uses && <div><AllowanceNote meta={{ ...meta, uses: meta.uses }} allowance={health.allowance} /></div>}
          {s.evidence && <div><Typography.Text type="warning" style={{ fontSize: 12 }}>{EVIDENCE[s.evidence]}</Typography.Text></div>}
        </>}
      />
    </List.Item>
  );
}

/** The ordered suggestions, then every check by group */
export function ChecksCard({ storeId, health, onDraft }: Props) {
  return (
    <ReadableSection>
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Card title="Do next" size="small">
          <List
            dataSource={health.suggestions}
            locale={{ emptyText: "Nothing left to do" }}
            renderItem={(s) => <SuggestionRow s={s} storeId={storeId} health={health} onDraft={onDraft} />}
          />
        </Card>
        {STOREFRONT_GROUPS.map((g) => (
          <Card key={g} title={STOREFRONT_GROUP_LABELS[g].en} size="small">
            <List
              dataSource={health.checks.filter((c) => STOREFRONT_CHECKS[c.key].group === g)}
              renderItem={(c) => (
                <List.Item actions={[<Link key="open" to={adminLink(STOREFRONT_CHECKS[c.key].adminPath, storeId)}>Open</Link>]}>
                  <List.Item.Meta
                    title={<Space>{STOREFRONT_CHECKS[c.key].title.en}<StatusTag check={c} /></Space>}
                    description={<>{STOREFRONT_CHECKS[c.key].what.en}<HeroCards cards={c.cards} /></>}
                  />
                </List.Item>
              )}
            />
          </Card>
        ))}
      </Space>
    </ReadableSection>
  );
}
