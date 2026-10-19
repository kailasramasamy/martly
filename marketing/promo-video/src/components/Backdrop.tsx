import type { ReactNode } from "react";
import { AbsoluteFill } from "remotion";
import { useCopy } from "../copy";
import { colors } from "../theme";

const BACKGROUNDS = {
  teal: `radial-gradient(circle at 30% 20%, ${colors.primary} 0%, ${colors.primaryDark} 55%, ${colors.primaryDeep} 100%)`,
  night: "radial-gradient(circle at 50% 30%, #1e293b 0%, #0f172a 60%, #020617 100%)",
};

export const Backdrop = ({ tone = "teal", children }: { tone?: keyof typeof BACKGROUNDS; children: ReactNode }) => {
  const { font } = useCopy();
  return <AbsoluteFill style={{ background: BACKGROUNDS[tone], fontFamily: font }}>{children}</AbsoluteFill>;
};
