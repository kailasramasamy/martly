import type { ReactNode } from "react";
import { View, StyleSheet } from "react-native";

export const PHONE_WIDTH = 216;
export const PHONE_HEIGHT = 392;

/** Schematic phone: dark bezel, notch, clipped screen */
export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <View style={styles.bezel}>
      <View style={styles.screen}>{children}</View>
      <View style={styles.notch} />
    </View>
  );
}

const styles = StyleSheet.create({
  bezel: {
    width: PHONE_WIDTH, height: PHONE_HEIGHT, borderRadius: 30, borderWidth: 5, borderColor: "#0f172a", backgroundColor: "#0f172a",
    shadowColor: "#0f172a", shadowOpacity: 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 8,
  },
  screen: { flex: 1, borderRadius: 24, backgroundColor: "#ffffff", overflow: "hidden", paddingTop: 20 },
  notch: { position: "absolute", top: 5, alignSelf: "center", width: 54, height: 12, borderRadius: 8, backgroundColor: "#0f172a" },
});
