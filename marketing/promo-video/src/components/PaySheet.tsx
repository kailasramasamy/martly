import { Banknote } from "lucide-react";
import { Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { rupee } from "../products";
import { colors } from "../theme";
import { usePop } from "./usePop";

const OPTIONS = [
  { name: "Google Pay", logo: "upi/gpay.png" },
  { name: "PhonePe", logo: "upi/phonepe.png" },
  { name: "Paytm", logo: "upi/paytm.png" },
  { name: "Cash on delivery" },
];

const OptionIcon = ({ logo }: { logo?: string }) =>
  logo ? (
    <Img src={staticFile(logo)} style={{ width: 64, height: 64, borderRadius: 16 }} />
  ) : (
    <div style={{ width: 64, height: 64, borderRadius: 16, background: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Banknote size={38} color="#15803d" strokeWidth={2.2} />
    </div>
  );

const SuccessBadge = ({ at }: { at: number }) => {
  const p = usePop(at, 10);
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: colors.surface,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 28,
        opacity: Math.min(p * 2, 1),
      }}
    >
      <div
        style={{
          width: 180,
          height: 180,
          borderRadius: 90,
          background: colors.success,
          color: colors.surface,
          fontSize: 110,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `scale(${p})`,
        }}
      >
        ✓
      </div>
      <div style={{ fontSize: 44, fontWeight: 800, color: colors.text }}>Order placed!</div>
    </div>
  );
};

export const PaySheet = ({ startAt, total }: { startAt: number; total: number }) => {
  const frame = useCurrentFrame();
  const p = usePop(startAt, 18);
  const selectAt = startAt + 30;
  if (frame < startAt) return null;
  return (
    <div style={{ position: "absolute", inset: 0, background: `rgba(15,23,42,${0.5 * Math.min(p, 1)})` }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          background: colors.surface,
          borderRadius: "40px 40px 0 0",
          padding: "40px 32px 60px",
          transform: `translateY(${interpolate(p, [0, 1], [800, 0])}px)`,
        }}
      >
        <div style={{ fontSize: 36, fontWeight: 800, color: colors.text, marginBottom: 24 }}>Pay {rupee(total)}</div>
        {OPTIONS.map(({ name, logo }, i) => {
          const selected = i === 0 && frame >= selectAt;
          return (
            <div
              key={name}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "20px 24px",
                marginBottom: 16,
                borderRadius: 20,
                fontSize: 30,
                fontWeight: 700,
                color: colors.text,
                border: `3px solid ${selected ? colors.primary : colors.border}`,
                background: selected ? "#f0fdfa" : colors.surface,
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 24 }}>
                <OptionIcon logo={logo} />
                {name}
              </span>
              <span style={{ color: selected ? colors.primary : colors.border, fontSize: 34 }}>{selected ? "●" : "○"}</span>
            </div>
          );
        })}
      </div>
      {frame >= selectAt + 20 && <SuccessBadge at={selectAt + 20} />}
    </div>
  );
};
