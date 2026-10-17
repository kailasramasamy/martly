import { Form, Tag, Typography } from "antd";

const FALLBACK_COLOR = "#0d9488";

const initials = (name = "") => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

/** Rough likeness of the app's store card, so owners see their branding before saving */
export function StoreCardPreview() {
  const form = Form.useFormInstance();
  const v = Form.useWatch([], form) ?? {};
  const color: string = v.brandColor || FALLBACK_COLOR;
  const offer: string | null = v.offerText || (v.freeDeliveryThreshold ? `Free delivery above ₹${v.freeDeliveryThreshold}` : null);
  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 16, overflow: "hidden", marginBottom: 16, maxWidth: 380 }}>
      <div style={{ height: 120, background: v.imageUrl ? `center / cover url(${v.imageUrl})` : "#e2e8f0", position: "relative" }}>
        <div style={{ position: "absolute", left: 12, bottom: -22, width: 48, height: 48, borderRadius: 12, border: "3px solid #fff", background: v.logoUrl ? `#fff center / cover url(${v.logoUrl})` : color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>
          {v.logoUrl ? null : initials(v.name)}
        </div>
      </div>
      <div style={{ height: 4, background: color }} />
      <div style={{ padding: "26px 12px 12px" }}>
        <Typography.Text strong style={{ fontSize: 16 }}>{v.name || "Store name"}</Typography.Text>
        <div style={{ color: "#64748b", fontSize: 13 }}>{v.tagline || "Tagline appears here"}</div>
        <div style={{ marginTop: 8 }}>{(v.highlights ?? []).map((h: string) => <Tag key={h} color={color}>{h}</Tag>)}</div>
        {offer && <div style={{ marginTop: 8, padding: "4px 8px", borderRadius: 8, background: "#fef3c7", color: "#92400e", fontWeight: 600, fontSize: 13 }}>{offer}</div>}
      </div>
    </div>
  );
}
