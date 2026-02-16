import React from "react";
import { theme as antTheme } from "antd";
import type { ThemeConfig } from "antd";

export const BRAND = {
  primary: "#0d9488",
  success: "#16a34a",
  warning: "#f59e0b",
  error: "#ef4444",
  info: "#0ea5e9",
};

export const CHART_COLORS = {
  bar: "#0d9488",
  line: "#14b8a6",
  area: "#5eead4",
  accent: "#0f766e",
};

export function sectionTitle(icon: React.ReactElement, text: string): React.ReactNode {
  return React.createElement("span", {
    style: { display: "inline-flex", alignItems: "center", gap: 8 },
  },
    React.cloneElement(icon as React.ReactElement<{ style?: React.CSSProperties }>, {
      style: { color: BRAND.primary, fontSize: 16 },
    }),
    text,
  );
}

const sharedTokens = {
  colorPrimary: BRAND.primary,
  borderRadius: 6,
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
};

const sharedComponents = {
  Layout: {
    siderBg: "#0f2a2e",
    triggerBg: "#0f2a2e",
    headerBg: "#0d9488",
    headerColor: "#ffffff",
  },
  Menu: {
    darkItemBg: "#0f2a2e",
    darkSubMenuItemBg: "#0a1f22",
    darkItemSelectedBg: "#0d9488",
    darkItemHoverBg: "rgba(13, 148, 136, 0.3)",
  },
  Card: {
    borderRadiusLG: 8,
  },
};

export const lightTheme: ThemeConfig = {
  token: sharedTokens,
  components: {
    ...sharedComponents,
    Table: {
      headerBg: "#f0fdfa",
      headerSortActiveBg: "#ccfbf1",
      headerSortHoverBg: "#ccfbf1",
    },
  },
};

export const darkTheme: ThemeConfig = {
  algorithm: antTheme.darkAlgorithm,
  token: sharedTokens,
  components: {
    ...sharedComponents,
    Table: {
      headerBg: "#1a2e2e",
      headerSortActiveBg: "#1a3a3a",
      headerSortHoverBg: "#1a3a3a",
    },
  },
};

// Keep backward compat export
export const theme = lightTheme;
