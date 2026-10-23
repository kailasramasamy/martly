import type { CSSProperties, ReactNode } from "react";

export type Style = CSSProperties;

/** React Native View defaults (column flex, no shrink) so the mockups port 1:1 */
export function V({ style, children }: { style?: Style; children?: ReactNode }) {
  return <div style={{ display: "flex", flexDirection: "column", position: "relative", boxSizing: "border-box", minWidth: 0, flexShrink: 0, ...style }}>{children}</div>;
}

/** Text with a bold weight shorthand; one line with an ellipsis when `clip` is set */
export function T({ style, clip, children }: { style?: Style; clip?: boolean; children: ReactNode }) {
  const clipped: Style = clip ? { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } : {};
  return <span style={{ lineHeight: 1.2, ...clipped, ...style }}>{children}</span>;
}

export const WEIGHT = { medium: 500, semibold: 600, bold: 700, extrabold: 800 } as const;
export const row: Style = { flexDirection: "row" };
export const fill: Style = { flex: "1 1 0%" };
export const TEAL = "#0f766e";
export const TEAL_LIGHT = "#14b8a6";
export const TEXT = "#0f172a";
