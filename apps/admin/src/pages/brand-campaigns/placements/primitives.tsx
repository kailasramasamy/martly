import type { ReactNode } from "react";
import { InboxOutlined, PlusOutlined, SearchOutlined } from "@ant-design/icons";
import { usePreviewBrand } from "./preview-context";
import { T, TEAL, TEAL_LIGHT, TEXT, V, WEIGHT, row, type Style } from "./ui";

export const BRAND_COLOR = "#f97316";
export const BRAND_TINT = "#ffedd5";
const GREY = "#e2e8f0";
const GREY_SOFT = "#f1f5f9";
const SLATE = "#cbd5e1";
const COVER: Style = { position: "absolute", inset: 0, width: "100%", height: "100%" };

type Size = number | string;

/** A skeleton text line */
export function Bar({ w = "100%", h = 5, style }: { w?: Size; h?: number; style?: Style }) {
  return <V style={{ width: w, height: h, borderRadius: h / 2, backgroundColor: GREY, ...style }} />;
}

/** A neutral skeleton block */
export function Box({ h, w, r = 8, style, children }: { h: number; w?: Size; r?: number; style?: Style; children?: ReactNode }) {
  return <V style={{ height: h, width: w, borderRadius: r, backgroundColor: GREY_SOFT, ...style }}>{children}</V>;
}

/** Ring and glow around the element the brand pays for, with a small callout */
export function Highlight({ children, label = "Your ad", style }: { children: ReactNode; label?: string; style?: Style }) {
  return (
    <V style={{ borderRadius: 12, border: `2px solid ${TEAL}`, boxShadow: `0 0 7px ${TEAL_LIGHT}`, ...style }}>
      {children}
      <V style={{ position: "absolute", top: -9, right: 8, backgroundColor: TEAL, borderRadius: 6, padding: "1.5px 5px" }}>
        <T style={{ fontWeight: WEIGHT.bold, fontSize: 8, color: "#ffffff" }}>{label}</T>
      </V>
    </V>
  );
}

export function SponsoredPill() {
  return (
    <V style={{ backgroundColor: "rgba(15,23,42,0.55)", borderRadius: 4, padding: "1px 4px" }}>
      <T style={{ fontWeight: WEIGHT.semibold, fontSize: 6.5, color: "#ffffff" }}>Sponsored</T>
    </V>
  );
}

/** The campaign's creative filling its slot, when there is one */
export function CreativeFill() {
  const { creativeUrl } = usePreviewBrand();
  return creativeUrl ? <img src={creativeUrl} alt="" draggable={false} style={{ ...COVER, objectFit: "cover" }} /> : null;
}

/** The brand's logo when known, else a placeholder block */
export function BrandMark({ size = 22, round }: { size?: number; round?: boolean }) {
  const { logoUrl } = usePreviewBrand();
  const shape: Style = { width: size, height: size, borderRadius: round ? size / 2 : size / 4, border: "1.5px solid #ffffff", alignItems: "center", justifyContent: "center", overflow: "hidden" };
  if (logoUrl) return <V style={{ ...shape, backgroundColor: "#ffffff" }}><img src={logoUrl} alt="" draggable={false} style={{ ...COVER, objectFit: "contain" }} /></V>;
  return (
    <V style={{ ...shape, backgroundColor: BRAND_COLOR }}>
      <T style={{ fontWeight: WEIGHT.extrabold, color: "#ffffff", letterSpacing: 0.3, fontSize: Math.max(5, size / 4.2) }}>BRAND</T>
    </V>
  );
}

type TileBadge = "Ad" | "Featured";

interface TileProps { brand?: boolean; badge?: TileBadge; off?: string; imageHeight?: number }

function TileArt() {
  const { productImageUrl, logoUrl } = usePreviewBrand();
  if (productImageUrl) return <img src={productImageUrl} alt="" draggable={false} style={{ ...COVER, objectFit: "cover", borderRadius: 6 }} />;
  if (logoUrl) return <img src={logoUrl} alt="" draggable={false} style={{ width: "62%", height: "62%", objectFit: "contain" }} />;
  return <InboxOutlined style={{ fontSize: 16, color: BRAND_COLOR }} />;
}

const cornerTag: Style = { position: "absolute", top: 2, borderRadius: 3, padding: "0.5px 3px" };

/** Product card as in the shopper grid; `brand` colours the image */
export function ProductTile({ brand, badge, off, imageHeight = 38 }: TileProps) {
  return (
    <V style={{ backgroundColor: "#ffffff", borderRadius: 8, border: `1px solid ${GREY}`, padding: 4, gap: 3 }}>
      <V style={{ height: imageHeight, borderRadius: 6, overflow: "hidden", backgroundColor: brand ? BRAND_TINT : GREY_SOFT, alignItems: "center", justifyContent: "center" }}>
        {brand ? <TileArt /> : null}
        {badge ? (
          <V style={{ ...cornerTag, left: 2, backgroundColor: badge === "Featured" ? TEAL : "#94a3b8" }}>
            <T style={{ fontWeight: WEIGHT.bold, fontSize: 6, color: "#ffffff" }}>{badge}</T>
          </V>
        ) : null}
        {off ? (
          <V style={{ ...cornerTag, right: 2, backgroundColor: "#fcd34d" }}>
            <T style={{ fontWeight: WEIGHT.extrabold, fontSize: 6, color: "#1c0a00" }}>{off}</T>
          </V>
        ) : null}
      </V>
      <Bar w="80%" h={4} style={{ marginTop: 1 }} />
      <V style={{ ...row, alignItems: "center", justifyContent: "space-between" }}>
        <Bar w="38%" h={5} style={{ backgroundColor: SLATE }} />
        <V style={{ width: 13, height: 13, borderRadius: 4, border: `1px solid ${TEAL}`, alignItems: "center", justifyContent: "center" }}>
          <PlusOutlined style={{ fontSize: 8, color: TEAL }} />
        </V>
      </V>
    </V>
  );
}

export function SearchBar({ text }: { text?: string }) {
  return (
    <V style={{ ...row, height: 22, borderRadius: 11, backgroundColor: GREY_SOFT, alignItems: "center", gap: 5, padding: "0 8px" }}>
      <SearchOutlined style={{ fontSize: 10, color: "#94a3b8" }} />
      {text ? <T style={{ fontWeight: WEIGHT.medium, fontSize: 9, color: TEXT }}>{text}</T> : <Bar w="45%" h={4} />}
    </V>
  );
}

export function HomeHeader() {
  return (
    <V style={{ gap: 6, padding: "4px 8px 6px" }}>
      <V style={{ ...row, alignItems: "center", justifyContent: "space-between" }}>
        <V style={{ gap: 3 }}><Bar w={26} h={4} /><Bar w={64} h={6} style={{ backgroundColor: SLATE }} /></V>
        <V style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: GREY }} />
      </V>
      <SearchBar />
    </V>
  );
}

export function FestiveHero() {
  return (
    <V style={{ height: 58, borderRadius: 10, backgroundColor: "#fef3c7", padding: 10, gap: 5, justifyContent: "center", margin: "0 8px" }}>
      <Bar w="50%" h={6} style={{ backgroundColor: "#fcd34d" }} />
      <Bar w="32%" h={4} style={{ backgroundColor: "#fde68a" }} />
    </V>
  );
}

/** Carousel slide as HeroBannerSlide draws it */
export function BrandSlide({ height = 78 }: { height?: number }) {
  const { creativeUrl } = usePreviewBrand();
  const bar: Style = { backgroundColor: "rgba(255,255,255,0.85)" };
  return (
    <V style={{ ...row, height, borderRadius: 10, overflow: "hidden", backgroundColor: BRAND_COLOR, padding: 10, alignItems: "center", gap: 8 }}>
      {creativeUrl ? <CreativeFill /> : (
        <>
          <V style={{ gap: 4, flex: "1 1 0%" }}>
            <Bar w="70%" h={6} style={bar} />
            <Bar w="45%" h={4} style={bar} />
            <V style={{ alignSelf: "flex-start", backgroundColor: "#ffffff", borderRadius: 8, padding: "2px 6px", marginTop: 2 }}>
              <T style={{ fontWeight: WEIGHT.bold, fontSize: 6.5, color: BRAND_COLOR }}>Shop now</T>
            </V>
          </V>
          <BrandMark size={34} round />
        </>
      )}
      <V style={{ position: "absolute", top: 5, left: 5 }}><SponsoredPill /></V>
    </V>
  );
}

export function Dots() {
  const dot: Style = { width: 4, height: 4, borderRadius: 2, backgroundColor: SLATE };
  return (
    <V style={{ ...row, justifyContent: "center", gap: 3, marginTop: 5 }}>
      <V style={{ ...dot, backgroundColor: TEAL, width: 10 }} />
      <V style={dot} /><V style={dot} />
    </V>
  );
}

export function SectionTitle({ w = 70 }: { w?: number }) {
  return <Bar w={w} h={6} style={{ backgroundColor: SLATE, marginTop: 4 }} />;
}

/** Row of product tiles, clipped by the phone edge */
export function TileRow({ count = 3, imageHeight = 34 }: { count?: number; imageHeight?: number }) {
  return (
    <V style={{ ...row, gap: 5 }}>
      {Array.from({ length: count }, (_, i) => <V key={i} style={{ flex: "1 1 0%" }}><ProductTile imageHeight={imageHeight} /></V>)}
    </V>
  );
}
