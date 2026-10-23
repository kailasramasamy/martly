import type { ReactNode } from "react";
import { LeftOutlined } from "@ant-design/icons";
import { PhoneFrame } from "./PhoneFrame";
import { Bar, BrandMark, BRAND_COLOR, CreativeFill, Highlight, ProductTile, SponsoredPill } from "./primitives";
import { usePreviewBrand } from "./preview-context";
import { T, TEAL, TEXT, V, WEIGHT, row, type Style } from "./ui";

export interface TileSpec { brand?: boolean; badge?: "Ad" | "Featured"; off?: string; lit?: boolean }

const plain: TileSpec = {};
const SLATE = "#cbd5e1";
const stripBar: Style = { backgroundColor: "rgba(255,255,255,0.85)" };

/** Two-column grid; lit tiles get the highlight ring */
export function TileGrid({ tiles, imageHeight = 34 }: { tiles: TileSpec[]; imageHeight?: number }) {
  const rows: TileSpec[][] = [];
  for (let i = 0; i < tiles.length; i += 2) rows.push(tiles.slice(i, i + 2));
  return (
    <V style={{ gap: 6 }}>
      {rows.map((tileRow, r) => (
        <V key={r} style={{ ...row, gap: 6 }}>
          {tileRow.map((t, c) => {
            const tile = <ProductTile brand={t.brand} badge={t.badge} off={t.off} imageHeight={imageHeight} />;
            return <V key={c} style={{ flex: "1 1 0%" }}>{t.lit ? <Highlight style={{ borderRadius: 10 }}>{tile}</Highlight> : tile}</V>;
          })}
        </V>
      ))}
    </V>
  );
}

export const fill = (n: number, lit: Record<number, TileSpec>): TileSpec[] => Array.from({ length: n }, (_, i) => lit[i] ?? plain);

/** Category page: back header, subcategory rail on the left, content on the right */
export function CategoryScreen({ children }: { children: ReactNode }) {
  const { categoryName } = usePreviewBrand();
  return (
    <PhoneFrame>
      <V style={{ ...row, alignItems: "center", gap: 6, padding: "0 8px 6px" }}>
        <LeftOutlined style={{ fontSize: 12, color: TEXT }} />
        {categoryName
          ? <T clip style={{ flex: "1 1 0%", fontWeight: WEIGHT.bold, fontSize: 9, color: TEXT }}>{categoryName}</T>
          : <Bar w={60} h={6} style={{ backgroundColor: SLATE }} />}
      </V>
      <V style={{ ...row, flex: "1 1 0%" }}>
        <V style={{ width: 36, backgroundColor: "#f8fafc", paddingTop: 4, gap: 2 }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <V key={i} style={{ alignItems: "center", gap: 3, padding: "5px 0", backgroundColor: i === 0 ? "#ccfbf1" : undefined }}>
              <V style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: i === 0 ? TEAL : "#e2e8f0" }} />
              <Bar w={20} h={3} />
            </V>
          ))}
        </V>
        <V style={{ flex: "1 1 0%", padding: 6, gap: 8 }}>{children}</V>
      </V>
    </PhoneFrame>
  );
}

/** The 2:1 strip at the top of a category page */
export function CategoryTakeoverMockup() {
  const { creativeUrl } = usePreviewBrand();
  return (
    <CategoryScreen>
      <Highlight style={{ height: 66, marginTop: 4 }}>
        <V style={{ ...row, flex: "1 1 0%", backgroundColor: BRAND_COLOR, borderRadius: 10, padding: 8, alignItems: "center", gap: 6, overflow: "hidden" }}>
          {creativeUrl ? <CreativeFill /> : (
            <>
              <V style={{ flex: "1 1 0%", gap: 4 }}>
                <Bar w="75%" h={6} style={stripBar} />
                <Bar w="50%" h={4} style={stripBar} />
              </V>
              <BrandMark size={28} round />
            </>
          )}
          <V style={{ position: "absolute", top: 4, left: 4 }}><SponsoredPill /></V>
        </V>
      </Highlight>
      <TileGrid tiles={fill(6, {})} />
    </CategoryScreen>
  );
}

/** Category listing with the sponsored product second */
export function CategorySponsoredMockup() {
  return (
    <CategoryScreen>
      <TileGrid tiles={fill(8, { 1: { brand: true, badge: "Ad", lit: true } })} />
    </CategoryScreen>
  );
}

/** Category listing with Featured products at slots 1, 4 and 7 */
export function CategoryFeaturedMockup() {
  const featured: TileSpec = { brand: true, badge: "Featured", lit: true };
  return (
    <CategoryScreen>
      <TileGrid tiles={fill(8, { 0: featured, 3: featured, 6: featured })} imageHeight={26} />
    </CategoryScreen>
  );
}

/** Products wearing the brand's discount tag, wherever they appear */
export function DiscountGridMockup() {
  const { offLabel } = usePreviewBrand();
  const off: TileSpec = { brand: true, off: offLabel ?? "10% OFF", lit: true };
  return (
    <PhoneFrame>
      <V style={{ padding: "10px 8px 8px" }}>
        <Bar w={80} h={6} style={{ backgroundColor: SLATE, marginBottom: 6 }} />
        <TileGrid tiles={fill(6, { 0: off, 3: off })} imageHeight={44} />
      </V>
    </PhoneFrame>
  );
}
