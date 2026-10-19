import type { CSSProperties, ReactNode } from "react";
import { manage } from "./tokens";

export const FormCard = ({ title, children }: { title: string; children: ReactNode }) => (
  <div style={{ background: "#fff", border: `1px solid ${manage.line}`, borderRadius: 14, padding: "16px 15px", marginBottom: 14 }}>
    <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.1, color: manage.textSecondary, marginBottom: 12 }}>{title}</div>
    {children}
  </div>
);

export const Label = ({ children, required }: { children: ReactNode; required?: boolean }) => (
  <div style={{ fontSize: 15, fontWeight: 500, color: manage.text, margin: "4px 0 8px" }}>
    {children}
    {required && <span style={{ color: "#ef4444" }}> *</span>}
  </div>
);

export const Field = ({ value, placeholder, prefix, style }: { value?: string; placeholder?: string; prefix?: string; style?: CSSProperties }) => (
  <div style={{ minHeight: 46, borderRadius: 12, border: `1px solid ${manage.line}`, padding: "12px 14px", fontSize: 16, display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 12, ...style }}>
    {prefix && <span style={{ color: manage.textSecondary }}>{prefix}</span>}
    <span style={{ color: value ? manage.text : "#94a3b8" }}>{value || placeholder}</span>
  </div>
);

export const Toggle = ({ on }: { on: boolean }) => (
  <div style={{ width: 52, height: 30, borderRadius: 15, background: on ? manage.button : "#d1d5db", padding: 3, display: "flex", justifyContent: on ? "flex-end" : "flex-start" }}>
    <div style={{ width: 24, height: 24, borderRadius: 12, background: "#fff" }} />
  </div>
);

export const BottomButton = ({ children, enabled, pressed }: { children: ReactNode; enabled: boolean; pressed?: boolean }) => (
  <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, background: "#fff", borderTop: `1px solid ${manage.line}`, padding: "12px 16px 34px" }}>
    <div style={{ height: 48, borderRadius: 12, background: enabled ? manage.button : "#91b9b6", color: "#fff", fontSize: 17, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, transform: `scale(${pressed ? 0.96 : 1})` }}>
      {children}
    </div>
  </div>
);
