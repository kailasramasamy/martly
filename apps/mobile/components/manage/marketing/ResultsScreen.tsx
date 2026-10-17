import { ManageStackScreen } from "../ManageStackScreen";
import { SectionCard } from "../ui/SectionCard";
import { ListRow } from "../ui/ListRow";
import { EmptyState } from "../ui/EmptyState";
import { formatINR } from "../ui/tokens";
import { useResource } from "../../../lib/manage/use-resource";
import { useManageScope } from "../../../lib/manage-scope-context";
import { toQuery } from "../../../lib/manage/query";
import { PROMO_STATUS } from "./promo-utils";
import type { MarketingResults } from "./plan-types";

const DAYS = 30;

export function ResultsScreen() {
  const { organizationId } = useManageScope();
  const { data, loading, error, reload } = useResource<MarketingResults>(`/api/v1/marketing/results${toQuery({ days: DAYS, organizationId })}`);
  const promotions = data?.promotions ?? [];
  return (
    <ManageStackScreen title="Results" loading={loading} error={error} onRetry={reload} onRefresh={reload}>
      {data && promotions.length === 0 ? <EmptyState icon="stats-chart-outline" title="No results yet" message={`Promotions from the last ${DAYS} days show up here.`} /> : null}
      {promotions.length > 0 ? (
        <SectionCard title={`Promotions, last ${DAYS} days`} flush>
          {promotions.map((p) => (
            <ListRow
              key={p.id} title={p.title} imageUrl={p.imageUrl ?? undefined} icon="megaphone-outline" status={PROMO_STATUS[p.status as keyof typeof PROMO_STATUS]}
              subtitle={`${p.views.toLocaleString("en-IN")} views · ${p.taps.toLocaleString("en-IN")} taps · ${p.ctr}% CTR · ${p.orders} orders`} value={formatINR(p.revenue)}
            />
          ))}
        </SectionCard>
      ) : null}
    </ManageStackScreen>
  );
}
