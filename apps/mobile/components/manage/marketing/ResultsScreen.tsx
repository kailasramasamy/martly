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
  const empty = data && data.banners.length === 0 && data.promotions.length === 0;
  return (
    <ManageStackScreen title="Results" loading={loading} error={error} onRetry={reload} onRefresh={reload}>
      {empty ? <EmptyState icon="stats-chart-outline" title="No results yet" message={`Banners and promotions from the last ${DAYS} days show up here.`} /> : null}
      {data && data.banners.length > 0 ? (
        <SectionCard title={`Banners, last ${DAYS} days`} flush>
          {data.banners.map((b) => (
            <ListRow key={b.id} title={b.title} imageUrl={b.imageUrl} subtitle={`${b.views.toLocaleString("en-IN")} views · ${b.taps.toLocaleString("en-IN")} taps`} value={`${b.ctr}%`} caption="Tap rate" />
          ))}
        </SectionCard>
      ) : null}
      {data && data.promotions.length > 0 ? (
        <SectionCard title={`Promotions, last ${DAYS} days`} flush>
          {data.promotions.map((p) => (
            <ListRow key={p.id} title={p.brief} status={PROMO_STATUS[p.status as keyof typeof PROMO_STATUS]} subtitle={`${p.orders} orders · ${p.units} units`} value={formatINR(p.revenue)} icon="megaphone-outline" />
          ))}
        </SectionCard>
      ) : null}
    </ManageStackScreen>
  );
}
