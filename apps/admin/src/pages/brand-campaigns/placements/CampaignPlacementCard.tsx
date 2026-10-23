import { useEffect, useState } from "react";
import { Card, Typography } from "antd";
import type { AdProductKind } from "@martly/shared/constants";
import { axiosInstance } from "../../../providers/data-provider";
import type { Campaign } from "../types";
import { previewFor } from "./placement-previews";
import { PreviewBrandProvider, type PreviewBrand } from "./preview-context";

function offLabel({ discountType, discountValue }: Campaign): string | null {
  if (!discountValue) return null;
  if (discountType === "PERCENTAGE") return `${discountValue}% OFF`;
  return discountType === "FLAT" ? `₹${discountValue} OFF` : null;
}

function useSponsoredPhoto(campaign: Campaign): string | null {
  const [url, setUrl] = useState<string | null>(null);
  const sponsored = campaign.placement === "SPONSORED_PRODUCT" && !!campaign.actionTarget;
  useEffect(() => {
    if (!sponsored) return;
    axiosInstance.get(`/products/${campaign.actionTarget}`)
      .then((res) => setUrl(res.data.data.imageUrl))
      .catch(() => setUrl(null));
  }, [sponsored, campaign.actionTarget]);
  return url;
}

/** "Where it shows" with this campaign's own logo, creative, product and category in the mockups */
export function CampaignPlacementCard({ campaign }: { campaign: Campaign }) {
  const productImageUrl = useSponsoredPhoto(campaign);
  const preview = previewFor(campaign.product.kind as AdProductKind, campaign.placement);
  if (!preview) return null;

  const tab = campaign.placement === "BRAND_TAB";
  const brand: PreviewBrand = {
    logoUrl: tab ? campaign.imageUrl ?? campaign.brand.imageUrl : campaign.brand.imageUrl,
    creativeUrl: tab ? null : campaign.imageUrl,
    productImageUrl,
    categoryName: campaign.category?.name,
    offLabel: offLabel(campaign),
    brandName: campaign.brand.name,
  };
  return (
    <Card title="Where it shows" size="small" style={{ marginBottom: 16 }}>
      <PreviewBrandProvider value={brand}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>
          {preview.mockups.map((m, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 12, width: 216 }}>
              <m.render />
              <Typography.Text type="secondary">{m.caption}</Typography.Text>
            </div>
          ))}
        </div>
      </PreviewBrandProvider>
    </Card>
  );
}
