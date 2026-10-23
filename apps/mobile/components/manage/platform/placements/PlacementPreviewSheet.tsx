import { Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { AdProductKind } from "@martly/shared/constants";
import { BottomSheet } from "../../../search/BottomSheet";
import { colors, fonts } from "../../../../constants/theme";
import { previewFor } from "./placement-previews";
import { PreviewPager } from "./PreviewPager";

export interface PreviewTarget { name: string; kind: AdProductKind; placement: string | null }

interface Props { visible: boolean; target: PreviewTarget | null; onClose: () => void }

/** "Where it shows" text link; the 44px height keeps it tappable */
export function WhereItShowsLink({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.link} onPress={onPress} accessibilityRole="button" accessibilityLabel="Where it shows" hitSlop={{ left: 8, right: 8 }}>
      <Ionicons name="eye-outline" size={16} color={colors.primary} />
      <Text style={styles.linkText}>Where it shows</Text>
    </TouchableOpacity>
  );
}

export function PlacementPreviewSheet({ visible, target, onClose }: Props) {
  const preview = target ? previewFor(target.kind, target.placement) : null;
  if (!target || !preview) return null;
  return (
    <BottomSheet visible={visible} title={target.name} onClose={onClose} flush centeredTitle>
      <PreviewPager key={`${target.kind}-${target.placement}-${visible}`} mockups={preview.mockups} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  link: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, alignSelf: "flex-start" },
  linkText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.primary },
});
