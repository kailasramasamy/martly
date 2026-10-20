// Monkey-patch StyleSheet.create to inject the App-* fontFamily (Manrope, or Noto Sans Tamil in Tamil) into all text styles.
// On Android, custom fonts don't resolve via fontWeight alone — each weight needs
// an explicit fontFamily. This file MUST be the first import in the app entry point.

import { StyleSheet } from "react-native";
import { activeLanguage } from "./i18n";
import { usesTamilFont } from "./i18n/fonts";

const WEIGHT_TO_FONT: Record<string, string> = {
  bold: "App-Bold",
  "700": "App-Bold",
  "600": "App-SemiBold",
  "500": "App-Medium",
  normal: "App-Regular",
  "400": "App-Regular",
};

const DEFAULT_FONT = "App-Regular";

const origCreate = StyleSheet.create;

// Noto Sans Tamil sets visibly larger than Manrope at the same size, so Tamil text runs a size smaller; line heights
// stay, as Tamil's tall vowel signs need the room
const TAMIL_FONT_SCALE = 0.9;

// Styles are created before the saved language is read, so script-dependent values resolve when the text renders.
// Letter spacing pulls Tamil letter clusters apart ("த ள் ளு ப டி"), so it is dropped while the Tamil face is on.
function adaptToScript(style: Record<string, unknown>) {
  const { letterSpacing: spacing, fontSize: size } = style;
  if (typeof spacing === "number" && spacing !== 0) {
    Object.defineProperty(style, "letterSpacing", {
      enumerable: true,
      get: () => (usesTamilFont(activeLanguage()) ? 0 : spacing),
    });
  }
  if (typeof size === "number") {
    Object.defineProperty(style, "fontSize", {
      enumerable: true,
      get: () => (usesTamilFont(activeLanguage()) ? Math.round(size * TAMIL_FONT_SCALE * 2) / 2 : size),
    });
  }
}

(StyleSheet as any).create = function <T extends StyleSheet.NamedStyles<T>>(styles: T): T {
  for (const key of Object.keys(styles)) {
    const style = (styles as any)[key];
    if (style && typeof style === "object") adaptToScript(style);
    if (style && typeof style === "object" && !style.fontFamily) {
      if (style.fontWeight) {
        const mapped = WEIGHT_TO_FONT[String(style.fontWeight)];
        if (mapped) {
          style.fontFamily = mapped;
          delete style.fontWeight; // Android can't resolve fontWeight within a custom font family
        }
      } else if (
        style.fontSize !== undefined ||
        style.lineHeight !== undefined ||
        style.letterSpacing !== undefined ||
        style.textAlign !== undefined ||
        style.textTransform !== undefined ||
        style.textDecorationLine !== undefined
      ) {
        // Text style without explicit fontWeight — use regular
        style.fontFamily = DEFAULT_FONT;
      }
    }
  }
  return origCreate(styles);
};
