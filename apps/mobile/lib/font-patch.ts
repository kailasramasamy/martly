// Monkey-patch StyleSheet.create to inject Manrope fontFamily into all text styles.
// On Android, custom fonts don't resolve via fontWeight alone — each weight needs
// an explicit fontFamily. This file MUST be the first import in the app entry point.

import { StyleSheet } from "react-native";

const WEIGHT_TO_FONT: Record<string, string> = {
  bold: "Manrope-Bold",
  "700": "Manrope-Bold",
  "600": "Manrope-SemiBold",
  "500": "Manrope-Medium",
  normal: "Manrope-Regular",
  "400": "Manrope-Regular",
};

const DEFAULT_FONT = "Manrope-Regular";

const origCreate = StyleSheet.create;

(StyleSheet as any).create = function <T extends StyleSheet.NamedStyles<T>>(styles: T): T {
  for (const key of Object.keys(styles)) {
    const style = (styles as any)[key];
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
