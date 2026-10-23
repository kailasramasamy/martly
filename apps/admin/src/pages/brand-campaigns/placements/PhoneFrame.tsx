import type { ReactNode } from "react";
import { V } from "./ui";

export const PHONE_WIDTH = 216;
export const PHONE_HEIGHT = 392;

/** Schematic phone: dark bezel, notch, clipped screen */
export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <V style={{ width: PHONE_WIDTH, height: PHONE_HEIGHT, borderRadius: 30, border: "5px solid #0f172a", backgroundColor: "#0f172a", boxShadow: "0 8px 14px rgba(15,23,42,0.25)" }}>
      <V style={{ flex: "1 1 0%", borderRadius: 24, backgroundColor: "#ffffff", overflow: "hidden", paddingTop: 20 }}>{children}</V>
      <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 54, height: 12, borderRadius: 8, backgroundColor: "#0f172a" }} />
    </V>
  );
}
