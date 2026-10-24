import { PhoneFrame } from "./PhoneFrame";
import { Bar, Box, BrandMark, BrandSlide, CreativeFill, BRAND_COLOR, BRAND_TINT, Dots, FestiveHero, Highlight, HomeHeader, ProductTile, SectionTitle, TileRow } from "./primitives";
import { usePreviewBrand } from "./preview-context";
import { T, TEXT, V, WEIGHT, row, type Style } from "./ui";

const pad: Style = { padding: "8px 8px 0", gap: 5 };
const onBrand: Style = { backgroundColor: "rgba(255,255,255,0.85)" };

/** Home with the carousel slide highlighted, just below the category directory */
export function HomeCarouselMockup() {
  return (
    <PhoneFrame>
      <HomeHeader />
      <FestiveHero />
      <V style={pad}>
        <SectionTitle />
        <TileRow />
        <Highlight style={{ marginTop: 6 }}><BrandSlide /></Highlight>
        <Dots />
      </V>
    </PhoneFrame>
  );
}

function Poster({ brand }: { brand?: boolean }) {
  const { creativeUrl } = usePreviewBrand();
  const brandStyle: Style = { backgroundColor: BRAND_COLOR, alignItems: "center", justifyContent: "center", gap: 5 };
  const poster = (
    <V style={{ width: 64, height: 96, borderRadius: 8, overflow: "hidden", ...(brand ? brandStyle : {}) }}>
      {brand && creativeUrl ? <CreativeFill /> : brand ? <><BrandMark size={30} round /><Bar w="70%" h={5} style={onBrand} /><Bar w="45%" h={4} style={onBrand} /></> : <Box h={96} />}
    </V>
  );
  return brand ? <Highlight style={{ borderRadius: 10 }}>{poster}</Highlight> : poster;
}

/** Home scrolled down: a product row, then the Brand posters rail */
export function HomePosterMockup() {
  return (
    <PhoneFrame>
      <V style={pad}>
        <SectionTitle w={80} />
        <TileRow />
        <SectionTitle w={96} />
        <V style={{ ...row, gap: 6 }}>
          <Poster />
          <Poster brand />
          <Poster />
        </V>
      </V>
    </PhoneFrame>
  );
}

function OfferCard() {
  const { offLabel, brandName } = usePreviewBrand();
  return (
    <V style={{ backgroundColor: BRAND_TINT, borderRadius: 10, padding: 6, gap: 6 }}>
      <V style={{ ...row, alignItems: "center", gap: 6 }}>
        <BrandMark size={22} />
        <V style={{ flex: "1 1 0%", gap: 3 }}>
          <Bar w="70%" h={5} style={{ backgroundColor: BRAND_COLOR }} />
          <T clip style={{ fontWeight: WEIGHT.extrabold, fontSize: 8, color: TEXT }}>{offLabel ?? "10% OFF"} on {brandName ?? "BRAND"}</T>
        </V>
      </V>
      <V style={{ ...row, gap: 4 }}>
        {[0, 1, 2].map((i) => <V key={i} style={{ flex: "1 1 0%" }}><ProductTile brand imageHeight={26} /></V>)}
      </V>
    </V>
  );
}

/** Home with the carousel slide and a shoppable offer card highlighted */
export function HomePromotionMockup() {
  return (
    <PhoneFrame>
      <HomeHeader />
      <V style={pad}>
        <Highlight style={{ marginTop: 6 }}><BrandSlide height={66} /></Highlight>
        <Dots />
        <SectionTitle />
        <Highlight style={{ marginTop: 6 }}><OfferCard /></Highlight>
      </V>
    </PhoneFrame>
  );
}
