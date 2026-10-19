import type { CSSProperties, ReactNode } from "react";

/** Widest a form, settings block or action card gets, so its buttons stay near what they act on */
export const READABLE_MAX_WIDTH = 1040;

/**
 * Caps a section of a page at a readable width, beside the sidebar. Tables, boards and charts stay full width;
 * forms, settings, detail panels and cards with action buttons go in here. Narrower windows keep their full width.
 */
export function ReadableSection({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ maxWidth: READABLE_MAX_WIDTH, ...style }}>{children}</div>;
}
