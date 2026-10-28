import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { PhoneScene } from "../components/PhoneScene";
import { ScreenFlow, Screenshot } from "../components/ScreenFlow";
import { useCopy } from "../copy";

// Spoken rows on the 923px-wide speak-list preview: [top, bottom]; each one is "heard" in turn
const ROWS: [number, number][] = [[832, 952], [957, 1074], [1079, 1196], [1201, 1318], [1323, 1440], [1445, 1604]];
const HEARD_FROM = 14;
const HEARD_EVERY = 18;
const FIND_AT = 150;
const PREVIEW_TO_SCREEN = 604 / 923;
const PAPER = "#fffdf6";

/** Paper patches over rows not yet spoken, lifted one by one as each item is heard */
const SpokenList = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Screenshot src="screens/v2/15a-shop-speak-list.png" />
      {ROWS.map(([top, bottom], i) => {
        const shown = interpolate(frame, [HEARD_FROM + i * HEARD_EVERY, HEARD_FROM + i * HEARD_EVERY + 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return [60, 160].map((left) => (
          <div
            key={`${i}-${left}`}
            style={{
              position: "absolute",
              left: left * PREVIEW_TO_SCREEN,
              width: (left === 60 ? 88 : 710) * PREVIEW_TO_SCREEN,
              top: top * PREVIEW_TO_SCREEN,
              height: (bottom - top) * PREVIEW_TO_SCREEN,
              background: PAPER,
              opacity: 1 - shown,
            }}
          />
        ));
      })}
    </AbsoluteFill>
  );
};

export const Voice = () => {
  const copy = useCopy();
  return (
    <PhoneScene captions={[{ from: 0, to: FIND_AT - 4, lines: copy.voice }, { from: FIND_AT - 4, lines: copy.voiceCart }]}>
      <ScreenFlow
        steps={[
          { at: 0, screen: <SpokenList />, tap: { x: 461, y: 1884, at: FIND_AT - 8 } },
          { at: FIND_AT, screen: "screens/v2/15b-shop-speak-matches.png", tap: { x: 238, y: 1243, at: 205 } },
          { at: 220, screen: "screens/v2/16-shop-cart.png" },
        ]}
      />
    </PhoneScene>
  );
};
