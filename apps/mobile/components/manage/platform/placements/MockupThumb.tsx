import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { AdProductKind } from "@martly/shared/constants";
import { colors } from "../../../../constants/theme";
import { manage } from "../../ui/tokens";
import { PHONE_HEIGHT, PHONE_WIDTH } from "./PhoneFrame";
import { previewFor } from "./placement-previews";

interface Props { kind: AdProductKind; placement: string | null; width: number }

/** First mockup of a placement (which draws its own phone) as a small phone. The full-size phone is scaled from its top-left corner inside a box of the scaled size, so layout takes only the thumbnail's space. */
export function MockupThumb({ kind, placement, width }: Props) {
  const Mockup = previewFor(kind, placement)?.mockups[0]?.render;
  const scale = width / PHONE_WIDTH;
  const height = Math.round(PHONE_HEIGHT * scale);
  if (!Mockup) {
    return (
      <View style={[styles.fallback, { width, height: Math.min(height, width) }]}>
        <Ionicons name="phone-portrait-outline" size={Math.round(width / 2.5)} color={colors.primary} />
      </View>
    );
  }
  return (
    <View style={{ width, height, overflow: "hidden" }} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={{ width: PHONE_WIDTH, height: PHONE_HEIGHT, transformOrigin: "top left", transform: [{ scale }] }}>
        <Mockup />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: manage.tint },
});
