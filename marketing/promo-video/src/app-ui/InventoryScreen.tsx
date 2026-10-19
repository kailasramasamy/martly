import { Img, staticFile, useCurrentFrame } from "remotion";
import { ChevronDown, Plus, Search } from "lucide-react";
import { products } from "../products";
import { AppCanvas, BellIcon, ManageTabBar, StatusBar } from "./Canvas";
import { manage } from "./tokens";

const LOW = 5;
const STOCK = [4, 0, 64, 38, 12, 51, 29, 17];
const ITEMS = [products[4], products[2], products[0], products[1], products[7], products[3], products[6], products[5]].map((p, i) => ({ ...p, stock: STOCK[i] }));

const badgeStyle = (stock: number) =>
  stock === 0 ? { bg: "#fee2e2", fg: "#b91c1c" } : stock < LOW ? { bg: manage.attentionBg, fg: manage.attentionText } : { bg: "#dcfce7", fg: "#15803d" };

const Header = () => (
  <div style={{ background: manage.ink, padding: "0 12px 14px" }}>
    <StatusBar dark />
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
      <div style={{ flex: 1, height: 38, borderRadius: 19, background: manage.inkRaised, display: "flex", alignItems: "center", gap: 8, padding: "0 12px", color: manage.inkText, fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}>
        <span style={{ width: 7, height: 7, borderRadius: 4, background: manage.live }} />
        Harur Fresh Mart
        <ChevronDown size={16} style={{ marginLeft: "auto" }} />
      </div>
      <div style={{ height: 38, borderRadius: 19, background: manage.attention, color: manage.text, display: "flex", alignItems: "center", gap: 6, padding: "0 12px", fontSize: 14, fontWeight: 700, whiteSpace: "nowrap" }}>
        <Plus size={17} strokeWidth={2.4} /> Add product
      </div>
      <BellIcon count={10} />
    </div>
  </div>
);

const Card = ({ item }: { item: (typeof ITEMS)[number] }) => {
  const frame = useCurrentFrame();
  const b = badgeStyle(item.stock);
  const pulse = item.stock < LOW ? 1 + 0.08 * Math.max(0, Math.sin(frame / 4)) : 1;
  return (
    <div style={{ background: "#fff", borderRadius: 12, border: `1px solid ${item.stock < LOW ? b.fg : manage.line}`, overflow: "hidden" }}>
      <div style={{ position: "relative", height: 112, padding: 8 }}>
        <Img src={staticFile(item.image)} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        <span style={{ position: "absolute", top: 6, left: 6, padding: "3px 9px", borderRadius: 10, background: b.bg, color: b.fg, fontSize: 12, fontWeight: 700, transform: `scale(${pulse})`, transformOrigin: "left center" }}>{item.stock} left</span>
      </div>
      <div style={{ padding: "6px 8px 10px" }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: manage.text, lineHeight: 1.25, height: 34, overflow: "hidden" }}>{item.name}</div>
        <div style={{ fontSize: 12, color: manage.textSecondary, marginTop: 4 }}>
          {item.size} · <b style={{ color: manage.text }}>{"₹"}{item.price}</b>
        </div>
      </div>
    </div>
  );
};

const CHIPS = [
  { label: "All", on: true },
  { label: "Low stock", n: 3 },
  { label: "Out of stock", n: 1 },
];

export const InventoryScreen = () => (
  <AppCanvas>
    <Header />
    <div style={{ padding: "14px 16px 0" }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 1.2, color: manage.textSecondary }}>LISTED AT THIS STORE · 27,354</div>
      <div style={{ fontSize: 13, color: manage.textSecondary, marginTop: 4 }}>Tap a product to update its stock, price or visibility here</div>
      <div style={{ marginTop: 12, height: 44, borderRadius: 14, background: "#fff", border: `1px solid ${manage.line}`, display: "flex", alignItems: "center", gap: 10, padding: "0 14px", color: "#94a3b8", fontSize: 15 }}>
        <Search size={18} /> Search this store’s products
      </div>
      <div style={{ display: "flex", gap: 8, margin: "12px 0" }}>
        {CHIPS.map((c) => (
          <div key={c.label} style={{ height: 36, padding: c.n ? "0 6px 0 14px" : "0 16px", borderRadius: 18, display: "flex", alignItems: "center", gap: 8, fontSize: 14.5, fontWeight: 600, background: c.on ? manage.text : "#fff", color: c.on ? "#fff" : manage.text, border: `1px solid ${c.on ? manage.text : manage.line}` }}>
            {c.label}
            {c.n && <span style={{ minWidth: 24, height: 24, borderRadius: 12, background: manage.attentionBg, color: manage.attentionText, fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{c.n}</span>}
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        {ITEMS.slice(0, 6).map((item) => (
          <Card key={item.name} item={item} />
        ))}
      </div>
    </div>
    <ManageTabBar active="Inventory" />
  </AppCanvas>
);
