import type { ReactNode } from "react";
import { ImageBackground, StyleSheet } from "react-native";

/** The shop floor's colour, for anything that fades into it */
export const FLOOR = "#eef3f1";
const TILE = require("../../assets/images/store-walk/floor-tile.png");

/** The walk's floor: pale tiles with faint grout lines, behind the aisles and the route */
export function ShopFloor({ children }: { children: ReactNode }) {
  return <ImageBackground source={TILE} resizeMode="repeat" style={styles.floor}>{children}</ImageBackground>;
}

const styles = StyleSheet.create({
  floor: { flex: 1, backgroundColor: FLOOR },
});
