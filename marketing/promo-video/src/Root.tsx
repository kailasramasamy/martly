import { Composition } from "remotion";
import { PROMO_FRAMES, Promo } from "./Promo";
import { FPS, HEIGHT, WIDTH } from "./theme";

export const Root = () => (
  <>
    <Composition id="MartlyPromoEN" component={Promo} defaultProps={{ lang: "en" as const }} durationInFrames={PROMO_FRAMES} fps={FPS} width={WIDTH} height={HEIGHT} />
    <Composition id="MartlyPromoTA" component={Promo} defaultProps={{ lang: "ta" as const }} durationInFrames={PROMO_FRAMES} fps={FPS} width={WIDTH} height={HEIGHT} />
  </>
);
