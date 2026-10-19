import type { ReactNode } from "react";
import { colors } from "../theme";

export const PHONE_W = 640;
export const PHONE_H = 1345;

export const PhoneFrame = ({ children, style }: { children: ReactNode; style?: React.CSSProperties }) => (
  <div
    style={{
      width: PHONE_W,
      height: PHONE_H,
      borderRadius: 88,
      padding: 18,
      background: "#0b1220",
      boxShadow: "0 60px 120px rgba(0,0,0,0.45), inset 0 0 0 3px #334155",
      ...style,
    }}
  >
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        borderRadius: 72,
        overflow: "hidden",
        background: colors.background,
      }}
    >
      {children}
      <div
        style={{
          position: "absolute",
          top: 20,
          left: "50%",
          width: 180,
          height: 52,
          marginLeft: -90,
          borderRadius: 30,
          background: "#0b1220",
        }}
      />
    </div>
  </div>
);
