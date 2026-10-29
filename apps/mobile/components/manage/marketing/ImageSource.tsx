import { View, Text, StyleSheet } from "react-native";
import { BANNER_IMAGE_REQUIREMENTS } from "@martly/shared/constants";
import { colors, fonts } from "../../../constants/theme";

export function UploadGuidance() {
  return (
    <View style={styles.guidance}>
      {BANNER_IMAGE_REQUIREMENTS.guidance.map((line) => <Text key={line} style={styles.bullet}>{`• ${line}`}</Text>)}
    </View>
  );
}

const styles = StyleSheet.create({
  guidance: { gap: 4 },
  bullet: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
});
