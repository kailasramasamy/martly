import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { AbsoluteFill, Audio, interpolate, staticFile } from "remotion";
import { CopyProvider, type Lang } from "./copy";
import { Catalog } from "./scenes/Catalog";
import { Cta } from "./scenes/Cta";
import { Delivery } from "./scenes/Delivery";
import { Hook } from "./scenes/Hook";
import { Manage } from "./scenes/Manage";
import { Offers } from "./scenes/Offers";
import { Onboard } from "./scenes/Onboard";
import { Online } from "./scenes/Online";
import { Orders } from "./scenes/Orders";
import { OwnApp } from "./scenes/OwnApp";
import { Packs } from "./scenes/Packs";
import { Promos } from "./scenes/Promos";
import { Shop } from "./scenes/Shop";
import { Snap } from "./scenes/Snap";
import { Specials } from "./scenes/Specials";
import { Voice } from "./scenes/Voice";
import { FPS, TRANSITION_FRAMES } from "./theme";

export const SCENES = [
  { Component: Hook, frames: 130 },
  { Component: Online, frames: 150 },
  { Component: Catalog, frames: 150 },
  { Component: Onboard, frames: 230 },
  { Component: Snap, frames: 150 },
  { Component: Packs, frames: 150 },
  { Component: Specials, frames: 155 },
  { Component: Shop, frames: 290 },
  { Component: Voice, frames: 290 },
  { Component: Manage, frames: 210 },
  { Component: Orders, frames: 120 },
  { Component: Delivery, frames: 190 },
  { Component: Offers, frames: 170 },
  { Component: Promos, frames: 210 },
  { Component: OwnApp, frames: 120 },
  { Component: Cta, frames: 210 },
];

export const PROMO_FRAMES =
  SCENES.reduce((sum, s) => sum + s.frames, 0) - (SCENES.length - 1) * TRANSITION_FRAMES;

// Lands the track's beat drop (18.3s) on the cut into the Online scene
const MUSIC_START = Math.round(14.4 * FPS);
const FADE = FPS;

const timing = linearTiming({ durationInFrames: TRANSITION_FRAMES });

const musicVolume = (f: number) =>
  interpolate(f, [0, FADE / 2, PROMO_FRAMES - FADE * 1.5, PROMO_FRAMES], [0, 0.8, 0.8, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

export const Promo = ({ lang }: { lang: Lang }) => (
  <CopyProvider lang={lang}>
  <AbsoluteFill>
    <Audio src={staticFile("music/infraction-dance.ogg")} trimBefore={MUSIC_START} volume={musicVolume} />
    <TransitionSeries>
      {SCENES.flatMap(({ Component, frames }, i) => [
        ...(i > 0
          ? [<TransitionSeries.Transition key={`t${i}`} timing={timing} presentation={i === 1 ? fade() : slide({ direction: "from-right" })} />]
          : []),
        <TransitionSeries.Sequence key={`s${i}`} durationInFrames={frames}>
          <Component />
        </TransitionSeries.Sequence>,
      ])}
    </TransitionSeries>
  </AbsoluteFill>
  </CopyProvider>
);
