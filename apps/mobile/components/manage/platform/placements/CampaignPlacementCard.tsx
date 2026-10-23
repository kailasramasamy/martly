import { useEffect, useState } from "react";
import { api } from "../../../../lib/api";
import { SectionCard } from "../../ui/SectionCard";
import type { Campaign } from "../types";
import { previewFor } from "./placement-previews";
import { PreviewPager } from "./PreviewPager";
import { PreviewBrandProvider, type PreviewBrand } from "./preview-context";

function offLabel({ discountType, discountValue }: Campaign): string | null {
  if (!discountValue) return null;
  if (discountType === "PERCENTAGE") return `${discountValue}% OFF`;
  return discountType === "FLAT" ? `₹${discountValue} OFF` : null;
}

function useSponsoredPhoto(campaign: Campaign): string | null {
  const [url, setUrl] = useState<string | null>(null);
  const sponsored = campaign.placement === "SPONSORED_PRODUCT" && campaign.actionTarget;
  useEffect(() => {
    if (!sponsored) return;
    api.get<{ imageUrl: string | null }>(`/api/v1/products/${campaign.actionTarget}`)
      .then((res) => setUrl(res.data.imageUrl))
      .catch(() => setUrl(null));
  }, [sponsored, campaign.actionTarget]);
  return url;
}

/** "Where it shows" with this campaign's own logo, creative, product and category in the mockups */
export function CampaignPlacementCard({ campaign }: { campaign: Campaign }) {
  const productImageUrl = useSponsoredPhoto(campaign);
  const preview = previewFor(campaign.product.kind, campaign.placement);
  if (!preview) return null;

  const brand: PreviewBrand = {
    logoUrl: campaign.placement === "BRAND_TAB" ? campaign.imageUrl ?? campaign.brand.imageUrl : campaign.brand.imageUrl,
    creativeUrl: campaign.placement === "BRAND_TAB" ? null : campaign.imageUrl,
    productImageUrl,
    categoryName: campaign.category?.name,
    offLabel: offLabel(campaign),
    brandName: campaign.brand.name,
  };
  return (
    <SectionCard title="Where it shows">
      <PreviewBrandProvider value={brand}><PreviewPager mockups={preview.mockups} /></PreviewBrandProvider>
    </SectionCard>
  );
}
