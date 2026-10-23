import { AppstoreOutlined, HomeFilled, ShoppingCartOutlined } from "@ant-design/icons";
import type { ReactNode } from "react";
import { PhoneFrame } from "./PhoneFrame";
import { Bar, BrandMark, FestiveHero, Highlight, HomeHeader, TileRow } from "./primitives";
import { T, TEAL, TEXT, V, WEIGHT, row, type Style } from "./ui";

const tab: Style = { alignItems: "center", gap: 2, minWidth: 40, padding: "3px 0" };

function Tab({ icon, label, active }: { icon: ReactNode; label: string; active?: boolean }) {
  return (
    <V style={{ ...tab, color: active ? TEAL : "#94a3b8" }}>
      <span style={{ fontSize: 16, lineHeight: 1 }}>{icon}</span>
      <T style={{ fontWeight: WEIGHT.semibold, fontSize: 7 }}>{label}</T>
    </V>
  );
}

/** Bottom bar whose last slot carries the brand logo */
export function TabSlotMockup() {
  return (
    <PhoneFrame>
      <HomeHeader />
      <FestiveHero />
      <V style={{ padding: 8, gap: 5 }}>
        <Bar w={80} h={6} style={{ backgroundColor: "#cbd5e1" }} />
        <TileRow />
      </V>
      <V style={{ ...row, position: "absolute", left: 0, right: 0, bottom: 0, height: 58, backgroundColor: "#ffffff", borderTop: "1px solid #e2e8f0", alignItems: "center", justifyContent: "space-around", padding: "0 4px 4px" }}>
        <Tab icon={<HomeFilled />} label="Home" active />
        <Tab icon={<AppstoreOutlined />} label="Categories" />
        <Tab icon={<ShoppingCartOutlined />} label="Cart" />
        <Highlight style={{ borderRadius: 10, padding: "0 3px" }}>
          <V style={tab}>
            <BrandMark size={22} round />
            <T style={{ fontWeight: WEIGHT.semibold, fontSize: 7, color: TEXT }}>Brand</T>
          </V>
        </Highlight>
      </V>
    </PhoneFrame>
  );
}
