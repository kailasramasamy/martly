import { useOne } from "@refinedev/core";
import type { BannerActionType } from "@martly/shared/constants";
import { pathLabel, useCategoryTree } from "./category-target";

const RESOURCE_OF: Partial<Record<BannerActionType, string>> = { PRODUCT: "products", COLLECTION: "collections", BRAND: "brands" };

/** Where tapping the banner goes, by name rather than id */
export function TargetLabel({ type, target }: { type: BannerActionType; target: string | null }) {
  const tree = useCategoryTree();
  const resource = RESOURCE_OF[type];
  const { data } = useOne({ resource: resource ?? "products", id: target ?? "", queryOptions: { enabled: !!resource && !!target } });
  if (!target || type === "NONE") return <>—</>;
  if (type === "CATEGORY") return <>{pathLabel(tree, target) ?? target}</>;
  if (type === "URL") return <a href={target} target="_blank" rel="noreferrer">{target}</a>;
  if (resource) return <>{(data?.data?.name ?? data?.data?.title ?? target) as string}</>;
  return <>{target}</>;
}
