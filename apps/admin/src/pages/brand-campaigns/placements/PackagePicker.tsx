import { useState } from "react";
import { Button, Tag, Typography } from "antd";
import { CheckCircleFilled, EyeOutlined } from "@ant-design/icons";
import { formatRupees } from "../../promos/promo-utils";
import type { AdProduct } from "../../marketing/types";
import { MockupThumb } from "./MockupThumb";
import { PlacementPreviewModal } from "./PlacementPreviewModal";
import { previewFor } from "./placement-previews";

const TEAL = "#0d9488";

/** "₹4,000 / week", "₹9,000 / 14 days", "₹250 / 1,000 views" */
const packagePrice = (p: AdProduct) =>
  `${formatRupees(p.price)} / ${p.kind === "BRAND_CPM" ? "1,000 views" : p.durationDays === 7 ? "week" : `${p.durationDays} days`}`;

interface CardProps {
  pkg: AdProduct;
  selected: boolean;
  compact?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
  onPreview: () => void;
}

function PackageCard({ pkg, selected, compact, disabled, onSelect, onPreview }: CardProps) {
  const views = previewFor(pkg.kind, pkg.placement)?.mockups.length ?? 0;
  const clickable = !!onSelect && !disabled;
  return (
    <div
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? onSelect : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === "Enter" || e.key === " ") onSelect(); } : undefined}
      style={{
        display: "flex", gap: 12, padding: 12, borderRadius: 12, cursor: clickable ? "pointer" : "default",
        border: `1.5px solid ${selected ? TEAL : "#e2e8f0"}`, background: selected ? "rgba(13,148,136,0.06)" : "transparent",
      }}
    >
      <MockupThumb kind={pkg.kind} placement={pkg.placement} width={compact ? 56 : 110} />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <Typography.Text strong style={{ flex: 1 }}>{pkg.name}</Typography.Text>
          {selected && <CheckCircleFilled style={{ color: TEAL, fontSize: 18 }} />}
        </div>
        <Typography.Text style={{ color: TEAL, fontWeight: 600 }}>{packagePrice(pkg)}</Typography.Text>
        {!compact && pkg.description && (
          <Typography.Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ margin: 0 }}>{pkg.description}</Typography.Paragraph>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: "auto" }}>
          {!compact && views > 1 && <Tag color="cyan" style={{ margin: 0 }}>{views} views</Tag>}
          {views > 0 && (
            <Button type="link" size="small" icon={<EyeOutlined />} style={{ padding: 0 }} onClick={(e) => { e.stopPropagation(); onPreview(); }}>
              Where it shows
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

interface Props { value?: string; onChange?: (id: string) => void; packages: AdProduct[]; disabled?: boolean }

/** Visual package picker: the chosen package as a compact card, a grid of mockup cards to change it */
export function PackagePicker({ value, onChange, packages, disabled }: Props) {
  const [changing, setChanging] = useState(false);
  const [previewing, setPreviewing] = useState<AdProduct | null>(null);
  const selected = packages.find((p) => p.id === value);
  const showGrid = !disabled && (!selected || changing);
  const pick = (id: string) => { onChange?.(id); setChanging(false); };

  return (
    <div>
      {selected && !showGrid && (
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", maxWidth: 480 }}>
          <div style={{ flex: 1 }}><PackageCard pkg={selected} selected compact disabled onPreview={() => setPreviewing(selected)} /></div>
          {!disabled && <Button onClick={() => setChanging(true)}>Change</Button>}
        </div>
      )}
      {showGrid && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
          {packages.map((p) => (
            <PackageCard key={p.id} pkg={p} selected={p.id === value} onSelect={() => pick(p.id)} onPreview={() => setPreviewing(p)} />
          ))}
        </div>
      )}
      <PlacementPreviewModal target={previewing} onClose={() => setPreviewing(null)} />
    </div>
  );
}
